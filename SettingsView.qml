import QtQuick
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Model.js" as Model
import "modules/Registry.js" as Registry

// The panel's settings page (gear in the hero). Every control writes the
// widget's own shell.json entry through `changed(values)`, the same keys
// the Setup form edits: show<Id> per module, the coast spot and the module
// shown beside the bar icon.
Column {
  id: view

  property var bar: null
  property var settings: ({})

  signal changed(var values)
  signal done()

  readonly property string spotName: String(settings.spotName || "")
  readonly property string pillModule: Registry.pillModule(settings)

  property bool editingSpot: false
  property var spotSuggestions: []
  property int spotIndex: 0
  property string geocodePendingQuery: ""
  property string geocodeActiveQuery: ""

  function setting(name, fallback) {
    var value = settings ? settings[name] : undefined
    return value === undefined || value === null ? fallback : value
  }

  function toggleModule(id) {
    var values = {}
    values[Registry.settingKey(id)] = !Registry.isEnabled(settings, id)
    view.changed(values)
  }

  function pickSpot(suggestion) {
    if (!suggestion) return
    view.changed({ spotName: suggestion.name, spotLatitude: suggestion.latitude, spotLongitude: suggestion.longitude })
    stopEditingSpot()
  }

  function clearSpot() {
    view.changed({ spotName: "", spotLatitude: null, spotLongitude: null })
    stopEditingSpot()
  }

  function startEditingSpot() {
    editingSpot = true
    spotSuggestions = []
    spotIndex = 0
    Qt.callLater(function() {
      spotField.text = view.spotName
      spotField.selectAll()
      spotField.forceActiveFocus()
    })
  }

  function stopEditingSpot() {
    editingSpot = false
    spotSuggestions = []
    geocodeDebounce.stop()
  }

  function requestGeocode() {
    var query = spotField.text.trim()
    if (query.length < 2) {
      spotSuggestions = []
      return
    }
    geocodePendingQuery = query
    if (!geocodeProc.running) startGeocode()
  }

  function startGeocode() {
    geocodeActiveQuery = geocodePendingQuery
    geocodeProc.command = ["curl", "-fsS", "--max-time", "5",
      "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(geocodeActiveQuery) + "&count=5&language=en&format=json"]
    geocodeProc.running = true
  }

  width: parent ? parent.width : implicitWidth
  spacing: Style.space(10)

  Process {
    id: geocodeProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        view.spotSuggestions = view.editingSpot ? Model.parseGeocodingResults(text) : []
        view.spotIndex = 0
        if (view.geocodePendingQuery !== view.geocodeActiveQuery) Qt.callLater(view.startGeocode)
      }
    }
  }

  Timer {
    id: geocodeDebounce
    interval: 300
    onTriggered: view.requestGeocode()
  }

  component SectionLabel: PanelSectionHeader {
    x: Style.space(16)
    foreground: view.bar.foreground
    fontFamily: view.bar.fontFamily
  }

  component Chip: Rectangle {
    id: chip
    property string text: ""
    property bool selected: false
    signal activated()

    width: chipText.implicitWidth + Style.space(20)
    height: chipText.implicitHeight + Style.space(10)
    radius: Style.cornerRadius
    color: selected ? Style.hoverFillFor(view.bar.foreground, Commons.Color.accent)
      : chipMouse.containsMouse ? Qt.rgba(view.bar.foreground.r, view.bar.foreground.g, view.bar.foreground.b, 0.06) : "transparent"
    border.width: Style.spacing.hairline
    border.color: Qt.rgba(view.bar.foreground.r, view.bar.foreground.g, view.bar.foreground.b, selected ? 0.5 : 0.18)

    Text {
      id: chipText
      anchors.centerIn: parent
      textFormat: Text.PlainText
      text: chip.text
      color: chip.selected ? Style.hoverStateColor(view.bar.foreground, Commons.Color.accent) : view.bar.foreground
      font.family: view.bar.fontFamily
      font.pixelSize: Style.font.bodySmall
    }
    MouseArea {
      id: chipMouse
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: chip.activated()
    }
  }

  // ---- Header: title and the way back.
  Item {
    width: parent.width
    height: Math.max(settingsTitle.implicitHeight, backText.implicitHeight)

    Text {
      id: settingsTitle
      anchors.left: parent.left
      anchors.leftMargin: Style.space(16)
      anchors.verticalCenter: parent.verticalCenter
      text: "WEATHER+ MODULES"
      color: Qt.darker(view.bar.foreground, 1.4)
      font.family: view.bar.fontFamily
      font.pixelSize: Style.font.body
      font.letterSpacing: 1
    }
    Text {
      id: backText
      anchors.right: parent.right
      anchors.rightMargin: Style.space(20)
      anchors.verticalCenter: parent.verticalCenter
      text: "Done"
      color: backMouse.containsMouse ? Commons.Color.accent : view.bar.foreground
      font.family: view.bar.fontFamily
      font.pixelSize: Style.font.body

      MouseArea {
        id: backMouse
        anchors.fill: parent
        anchors.margins: -Style.space(6)
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: view.done()
      }
    }
  }

  // ---- One switch per module.
  Repeater {
    model: Registry.MODULES

    Toggle {
      required property var modelData
      x: Style.space(8)
      width: view.width - Style.space(16)
      label: modelData.title
      description: modelData.description
      checked: Registry.isEnabled(view.settings, modelData.id)
      foreground: view.bar.foreground
      fontFamily: view.bar.fontFamily
      titleSize: Style.font.body
      onClicked: view.toggleModule(modelData.id)
    }
  }

  // ---- Coast spot for tides and swell.
  PanelSeparator {
    visible: Registry.usesSpot(view.settings)
    width: parent.width
    foreground: view.bar.foreground
  }

  SectionLabel {
    visible: Registry.usesSpot(view.settings)
    text: "COAST SPOT"
  }

  Item {
    visible: Registry.usesSpot(view.settings)
    width: parent.width
    height: Math.max(spotLabel.implicitHeight, spotField.implicitHeight)

    Text {
      id: spotLabel
      visible: !view.editingSpot
      anchors.left: parent.left
      anchors.leftMargin: Style.space(16)
      anchors.right: parent.right
      anchors.rightMargin: Style.space(20)
      anchors.verticalCenter: parent.verticalCenter
      textFormat: Text.PlainText
      text: (view.spotName || "Same as the weather location") + "  ·  change"
      elide: Text.ElideRight
      color: spotMouse.containsMouse ? Commons.Color.accent : view.bar.foreground
      font.family: view.bar.fontFamily
      font.pixelSize: Style.font.body

      MouseArea {
        id: spotMouse
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: view.startEditingSpot()
      }
    }

    Row {
      visible: view.editingSpot
      x: Style.space(16)
      anchors.verticalCenter: parent.verticalCenter
      spacing: Style.space(10)

      TextField {
        id: spotField
        width: Style.space(260)
        placeholderText: "Search a beach or town"
        foreground: view.bar.foreground
        font.family: view.bar.fontFamily

        onTextChanged: if (view.editingSpot) geocodeDebounce.restart()

        Keys.onPressed: function(event) {
          if (event.key === Qt.Key_Escape) {
            view.stopEditingSpot()
            event.accepted = true
          } else if (event.key === Qt.Key_Down) {
            if (view.spotIndex < view.spotSuggestions.length - 1) view.spotIndex++
            event.accepted = true
          } else if (event.key === Qt.Key_Up) {
            if (view.spotIndex > 0) view.spotIndex--
            event.accepted = true
          } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
            if (spotField.text.trim() === "") view.clearSpot()
            else view.pickSpot(view.spotSuggestions[view.spotIndex])
            event.accepted = true
          }
        }
      }

      Text {
        anchors.verticalCenter: parent.verticalCenter
        text: "Use weather location"
        color: clearSpotMouse.containsMouse ? Commons.Color.accent : Qt.darker(view.bar.foreground, 1.4)
        font.family: view.bar.fontFamily
        font.pixelSize: Style.font.bodySmall

        MouseArea {
          id: clearSpotMouse
          anchors.fill: parent
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onClicked: view.clearSpot()
        }
      }
    }
  }

  Column {
    visible: view.editingSpot && view.spotSuggestions.length > 0
    width: parent.width

    Repeater {
      model: view.spotSuggestions

      Rectangle {
        required property var modelData
        required property int index
        width: parent.width
        height: suggestionRow.implicitHeight + Style.space(12)
        radius: Style.cornerRadius
        color: index === view.spotIndex ? Style.hoverFillFor(view.bar.foreground, Commons.Color.accent) : "transparent"

        Row {
          id: suggestionRow
          anchors.left: parent.left
          anchors.leftMargin: Style.space(16)
          anchors.verticalCenter: parent.verticalCenter
          spacing: Style.space(8)

          Text {
            textFormat: Text.PlainText
            text: modelData.name
            color: index === view.spotIndex ? Style.hoverStateColor(view.bar.foreground, Commons.Color.accent) : view.bar.foreground
            font.family: view.bar.fontFamily
            font.pixelSize: Style.font.body
          }
          Text {
            visible: text !== ""
            textFormat: Text.PlainText
            text: modelData.description
            color: Qt.darker(view.bar.foreground, 1.5)
            font.family: view.bar.fontFamily
            font.pixelSize: Style.font.bodySmall
            anchors.verticalCenter: parent.verticalCenter
          }
        }

        MouseArea {
          anchors.fill: parent
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onPositionChanged: view.spotIndex = index
          onClicked: view.pickSpot(modelData)
        }
      }
    }
  }

  // ---- What the bar shows next to the weather icon.
  PanelSeparator {
    width: parent.width
    foreground: view.bar.foreground
  }

  SectionLabel {
    text: "IN THE BAR"
  }

  Flow {
    x: Style.space(16)
    width: parent.width - Style.space(36)
    spacing: Style.space(8)

    Chip {
      text: "Icon only"
      selected: view.pillModule === ""
      onActivated: view.changed({ pillModule: "none" })
    }
    Repeater {
      model: Registry.MODULES.filter(function(m) { return Registry.isEnabled(view.settings, m.id) })

      Chip {
        required property var modelData
        text: modelData.title
        selected: view.pillModule === modelData.id
        onActivated: view.changed({ pillModule: modelData.id })
      }
    }
  }

  Item { width: 1; height: Style.space(4) }
}
