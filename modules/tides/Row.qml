import QtQuick
import qs.Commons
import "../../core"
import "Source.js" as Tides

// Sea level at the coast spot: where the tide is now, the next high and
// low water, and the curve for the next two days.
Column {
  id: row

  property var bar: null
  property var entry: null
  property string status: ""
  property var ctx: ({})
  property real now: Date.now()

  readonly property var reading: entry ? entry.value : null
  readonly property bool inland: !!reading && !!reading.inland
  readonly property var outlook: reading && !inland ? Tides.outlook(reading, now) : ({ next: [], rising: null })
  readonly property var spot: ctx.spot || null
  readonly property bool imperial: !!ctx.imperial

  function time(ms) { return Qt.formatTime(new Date(ms), "HH:mm") }

  width: parent ? parent.width : implicitWidth
  spacing: Style.space(14)

  StatsLine {
    bar: row.bar
    title: "TIDES"
    subtitle: row.spot ? row.spot.name : ""
    stale: !!row.entry && row.entry.stale
    ageMs: row.entry ? row.entry.ageMs : 0
    message: row.status === "idle" ? "Set a coast spot in ⚙"
      : row.inland ? "No sea at this spot"
      : !row.reading ? (row.status === "failed" ? "Unavailable" : "Fetching…")
      : row.outlook.next.length === 0 ? "No forecast" : ""

    Stat {
      bar: row.bar
      label: "NOW"
      value: Tides.formatHeight(Tides.heightAt(row.reading, row.now), row.imperial)
      caption: row.outlook.rising === null ? "" : row.outlook.rising ? "rising" : "falling"
    }
    Repeater {
      model: row.outlook.next

      Stat {
        required property var modelData
        bar: row.bar
        label: modelData.kind === "high" ? "HIGH" : "LOW"
        value: row.time(modelData.at)
        caption: Tides.formatHeight(modelData.height, row.imperial)
      }
    }
  }

  BrailleChart {
    visible: !!row.reading && !row.inland
    width: parent.width
    bar: row.bar
    title: "SEA LEVEL · 48H"
    history: row.reading && row.reading.points ? row.reading.points.map(function(p) { return { at: p.at, value: p.height } }) : []
    fromMs: -3 * 60 * 60 * 1000
    toMs: 45 * 60 * 60 * 1000
    emptyText: "no forecast"
    formatValue: function(value) { return Tides.formatHeight(value, row.imperial) }
  }
}
