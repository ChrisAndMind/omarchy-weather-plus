import QtQuick
import qs.Commons
import "River.js" as River

// Eisbach water temperature and flow, styled like the hero's FEELS/WIND/HUMID
// stats. Stale values (API returned null, cached reading < 24h old) are
// dimmed and carry their age; missing values read "-".
Item {
  id: row

  property var bar: null
  property var river: null
  property bool useImperial: false

  readonly property var temperature: river ? river.temperatureC : null
  readonly property var flow: river ? river.flowM3s : null

  width: parent ? parent.width : implicitWidth
  implicitHeight: Math.max(riverName.implicitHeight, stats.implicitHeight)

  component Stat: Column {
    property string label: ""
    property string value: ""
    property var entry: null

    spacing: Style.space(5)

    Text {
      text: parent.label
      color: Qt.darker(row.bar.foreground, 1.5)
      font.family: row.bar.fontFamily
      font.pixelSize: Style.font.bodySmall
      font.letterSpacing: 1
    }
    Text {
      textFormat: Text.PlainText
      text: parent.value
      opacity: parent.entry && parent.entry.stale ? 0.5 : 1
      color: row.bar.foreground
      font.family: row.bar.fontFamily
      font.pixelSize: Style.font.title
    }
    Text {
      visible: !!parent.entry && parent.entry.stale
      textFormat: Text.PlainText
      text: parent.entry ? River.formatAge(parent.entry.ageMs) : ""
      color: Qt.darker(row.bar.foreground, 1.5)
      font.family: row.bar.fontFamily
      font.pixelSize: Style.font.caption
      font.italic: true
    }
  }

  Text {
    id: riverName
    anchors.left: parent.left
    anchors.leftMargin: Style.space(16)
    anchors.verticalCenter: parent.verticalCenter
    text: "EISBACH"
    color: Qt.darker(row.bar.foreground, 1.4)
    font.family: row.bar.fontFamily
    font.pixelSize: Style.font.body
    font.letterSpacing: 1
  }

  Row {
    id: stats
    anchors.right: parent.right
    anchors.rightMargin: Style.space(20)
    anchors.verticalCenter: parent.verticalCenter
    spacing: Style.space(36)

    Stat {
      label: "WATER"
      entry: row.temperature
      value: River.formatRiverTemp(row.temperature, row.useImperial)
    }
    Stat {
      label: "FLOW"
      entry: row.flow
      value: River.formatRiverFlow(row.flow)
    }
  }
}
