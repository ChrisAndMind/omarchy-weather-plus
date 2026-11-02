import QtQuick
import qs.Commons
import "../../core"
import "Source.js" as Eisbach

// Eisbach water temperature and flow. Stale values (API returned null,
// cached reading < 24h old) are dimmed and carry their age; missing values
// read "-". The weekly flow trend sits underneath.
Column {
  id: row

  property var bar: null
  property var entry: null
  property string status: ""
  property var ctx: ({})
  property real now: Date.now()

  readonly property var river: entry ? entry.value : null
  readonly property var temperature: river ? river.temperatureC : null
  readonly property var flow: river ? river.flowM3s : null

  width: parent ? parent.width : implicitWidth
  spacing: Style.space(14)

  StatsLine {
    bar: row.bar
    title: "EISBACH"
    message: row.river ? "" : (row.status === "failed" ? "Unavailable" : "Fetching…")

    Stat {
      bar: row.bar
      label: "WATER"
      value: Eisbach.formatRiverTemp(row.temperature, row.ctx.imperial)
      stale: !!row.temperature && row.temperature.stale
      ageMs: row.temperature ? row.temperature.ageMs : 0
    }
    Stat {
      bar: row.bar
      label: "FLOW"
      value: Eisbach.formatRiverFlow(row.flow)
      stale: !!row.flow && row.flow.stale
      ageMs: row.flow ? row.flow.ageMs : 0
    }
  }

  BrailleChart {
    visible: !!row.river
    width: parent.width
    bar: row.bar
    title: "FLOW · 7D"
    history: row.river ? row.river.history : []
    fromMs: -Eisbach.HISTORY_WINDOW_MS
    toMs: 0
    formatValue: function(value) { return value.toFixed(1) + " m³/s" }
    formatRange: function(min, max) { return Eisbach.formatFlowRange(min, max) }
  }
}
