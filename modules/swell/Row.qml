import QtQuick
import qs.Commons
import "../../core"
import "Source.js" as Swell

// Swell, sea temperature and wind at the coast spot, and the swell height
// over the next two days.
Column {
  id: row

  property var bar: null
  property var entry: null
  property string status: ""
  property var ctx: ({})
  property real now: Date.now()

  readonly property var reading: entry ? entry.value : null
  readonly property bool inland: !!reading && !!reading.inland
  readonly property var spot: ctx.spot || null
  readonly property bool imperial: !!ctx.imperial
  readonly property bool stale: !!entry && entry.stale

  width: parent ? parent.width : implicitWidth
  spacing: Style.space(14)

  StatsLine {
    bar: row.bar
    title: "SWELL"
    subtitle: row.spot ? row.spot.name : ""
    stale: row.stale
    ageMs: row.entry ? row.entry.ageMs : 0
    message: row.status === "idle" ? "Set a coast spot in ⚙"
      : row.inland ? "No sea at this spot"
      : !row.reading ? (row.status === "failed" ? "Unavailable" : "Fetching…") : ""

    Stat {
      bar: row.bar
      label: "SWELL"
      value: Swell.formatSwell(row.reading, row.imperial)
      caption: row.reading && row.reading.swellDirection !== null ? "from " + Swell.compass(row.reading.swellDirection) : ""
    }
    Stat {
      bar: row.bar
      label: "SEA"
      value: Swell.formatSeaTemp(row.reading ? row.reading.seaTemp : null, row.imperial)
    }
    Stat {
      bar: row.bar
      label: "WIND"
      value: Swell.formatWind(row.reading, row.imperial)
      caption: row.reading && row.reading.windGusts !== null
        ? "gusts " + (row.imperial ? Math.round(row.reading.windGusts * 0.621371) + " mph" : Math.round(row.reading.windGusts) + " km/h") : ""
    }
  }

  BrailleChart {
    visible: !!row.reading && !row.inland
    width: parent.width
    bar: row.bar
    title: "SWELL · 48H"
    history: row.reading && row.reading.forecast ? row.reading.forecast : []
    fromMs: 0
    toMs: 48 * 60 * 60 * 1000
    emptyText: "no forecast"
    formatValue: function(value) { return Swell.formatMetres(value, row.imperial) }
  }
}
