import QtQuick
import qs.Commons
import "../../core"
import "Source.js" as Rain

// Rain in the next two hours: one block per 15 minutes, and when it starts
// or stops.
Column {
  id: row

  property var bar: null
  property var entry: null
  property string status: ""
  property var ctx: ({})
  property real now: Date.now()

  readonly property var reading: entry ? entry.value : null
  readonly property var summary: reading ? Rain.summarize(reading, now) : null

  width: parent ? parent.width : implicitWidth

  StatsLine {
    bar: row.bar
    title: "RAIN"
    stale: !!row.entry && row.entry.stale
    ageMs: row.entry ? row.entry.ageMs : 0
    message: row.reading ? "" : (row.status === "failed" ? "Unavailable" : row.status === "idle" ? "Needs a location" : "Fetching…")

    Column {
      spacing: Style.space(4)

      Text {
        anchors.right: parent.right
        textFormat: Text.PlainText
        text: row.reading ? Rain.sparkline(row.reading, row.now) : ""
        opacity: row.entry && row.entry.stale ? 0.5 : 1
        color: row.summary && row.summary.state !== "dry" ? Commons.Color.accent : row.bar.foreground
        font.family: row.bar.fontFamily
        font.pixelSize: Style.font.title
        font.letterSpacing: 2
      }
      Text {
        anchors.right: parent.right
        textFormat: Text.PlainText
        text: row.summary ? Rain.describe(row.summary) : ""
        color: Qt.darker(row.bar.foreground, 1.5)
        font.family: row.bar.fontFamily
        font.pixelSize: Style.font.bodySmall
      }
    }
  }
}
