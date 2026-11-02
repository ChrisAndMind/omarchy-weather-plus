import QtQuick
import qs.Commons
import "../../core"
import "Source.js" as Alerts

// Active DWD warnings, most severe first, each with a severity dot in the
// DWD colours and its validity. Clicking a warning shows its description.
Column {
  id: row

  property var bar: null
  property var entry: null
  property string status: ""
  property var ctx: ({})
  property real now: Date.now()

  readonly property var reading: entry ? entry.value : null
  readonly property var active: reading ? Alerts.current(reading, now) : []
  readonly property string language: ctx.language === "de" ? "de" : "en"
  property int expandedIndex: -1

  readonly property var severityColors: ({ minor: "#f5c211", moderate: "#ff8c00", severe: "#e01b24", extreme: "#a51d9d" })

  function validity(alert) {
    var format = function(ms) { return Qt.formatDateTime(new Date(ms), "ddd HH:mm") }
    if (alert.onset !== null && alert.onset > row.now) return "from " + format(alert.onset) + (alert.expires ? " until " + format(alert.expires) : "")
    return alert.expires ? "until " + format(alert.expires) : ""
  }

  width: parent ? parent.width : implicitWidth
  spacing: Style.space(10)

  StatsLine {
    bar: row.bar
    title: "WARNINGS"
    subtitle: row.reading ? row.reading.area : ""
    stale: !!row.entry && row.entry.stale
    ageMs: row.entry ? row.entry.ageMs : 0
    message: !row.reading ? (row.status === "failed" ? "Germany only · unavailable here" : row.status === "idle" ? "Needs a location" : "Fetching…")
      : row.active.length === 0 ? "No warnings" : ""

    Stat {
      bar: row.bar
      label: "ACTIVE"
      value: String(row.active.length)
    }
  }

  Repeater {
    model: row.active

    Item {
      required property var modelData
      required property int index

      width: row.width
      height: alertColumn.implicitHeight

      Rectangle {
        id: dot
        x: Style.space(16)
        y: Style.space(6)
        width: Style.space(8)
        height: width
        radius: width / 2
        color: row.severityColors[modelData.severity] || row.severityColors.minor
      }

      Column {
        id: alertColumn
        anchors.left: dot.right
        anchors.leftMargin: Style.space(10)
        anchors.right: parent.right
        anchors.rightMargin: Style.space(20)
        spacing: Style.space(3)

        Text {
          width: parent.width
          textFormat: Text.PlainText
          text: Alerts.text(modelData.headline, row.language)
          color: row.bar.foreground
          font.family: row.bar.fontFamily
          font.pixelSize: Style.font.body
          wrapMode: Text.Wrap
        }
        Text {
          visible: text !== ""
          textFormat: Text.PlainText
          text: row.validity(modelData)
          color: Qt.darker(row.bar.foreground, 1.5)
          font.family: row.bar.fontFamily
          font.pixelSize: Style.font.caption
        }
        Text {
          visible: row.expandedIndex === index
          width: parent.width
          textFormat: Text.PlainText
          text: Alerts.text(modelData.description, row.language)
          color: Qt.darker(row.bar.foreground, 1.3)
          font.family: row.bar.fontFamily
          font.pixelSize: Style.font.bodySmall
          wrapMode: Text.Wrap
        }
      }

      MouseArea {
        anchors.fill: parent
        cursorShape: Qt.PointingHandCursor
        onClicked: row.expandedIndex = row.expandedIndex === index ? -1 : index
      }
    }
  }
}
