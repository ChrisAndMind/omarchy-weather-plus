import QtQuick
import qs.Commons
import "../../core"
import "Source.js" as Air

// European air quality index, UV index and the strongest pollen.
Column {
  id: row

  property var bar: null
  property var entry: null
  property string status: ""
  property var ctx: ({})
  property real now: Date.now()

  readonly property var reading: entry ? entry.value : null
  readonly property var pollen: reading ? Air.topPollen(reading) : null
  readonly property bool stale: !!entry && entry.stale

  width: parent ? parent.width : implicitWidth

  StatsLine {
    bar: row.bar
    title: "AIR"
    stale: row.stale
    ageMs: row.entry ? row.entry.ageMs : 0
    message: row.reading ? "" : (row.status === "failed" ? "Unavailable" : row.status === "idle" ? "Needs a location" : "Fetching…")

    Stat {
      bar: row.bar
      label: "AQI"
      value: row.reading && row.reading.aqi !== null ? String(Math.round(row.reading.aqi)) : "-"
      caption: row.reading ? Air.aqiBand(row.reading.aqi) : ""
    }
    Stat {
      bar: row.bar
      label: "UV"
      value: row.reading && row.reading.uv !== null ? row.reading.uv.toFixed(1) : "-"
      caption: row.reading ? Air.uvBand(row.reading.uv) : ""
    }
    Stat {
      bar: row.bar
      visible: !!row.reading && row.reading.pollen.length > 0
      label: "POLLEN"
      value: row.pollen ? row.pollen.name : "None"
      caption: row.pollen ? Air.pollenLevel(row.pollen.value) : ""
    }
  }
}
