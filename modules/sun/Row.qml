import QtQuick
import qs.Commons
import "../../core"
import "Source.js" as Sun

// Today's sun times and the moon, computed locally.
Column {
  id: row

  property var bar: null
  property var entry: null
  property string status: ""
  property var ctx: ({})
  property real now: Date.now()

  readonly property var reading: entry ? entry.value : null
  readonly property string polarMessage: !reading ? "" : reading.polar === "day" ? "Midnight sun" : reading.polar === "night" ? "Polar night" : ""

  function time(ms) {
    return ms === null || ms === undefined ? "-" : Qt.formatTime(new Date(ms), "HH:mm")
  }

  width: parent ? parent.width : implicitWidth
  spacing: Style.space(14)

  StatsLine {
    bar: row.bar
    title: "SUN"
    message: !row.reading ? "Needs a location" : row.polarMessage

    Stat {
      bar: row.bar
      label: "RISE"
      value: row.time(row.reading ? row.reading.sunrise : null)
    }
    Stat {
      bar: row.bar
      label: "GOLDEN"
      value: row.time(row.reading ? row.reading.goldenStart : null)
    }
    Stat {
      bar: row.bar
      label: "SET"
      value: row.time(row.reading ? row.reading.sunset : null)
    }
  }

  StatsLine {
    visible: !!row.reading
    bar: row.bar
    title: "DAY & MOON"

    Stat {
      bar: row.bar
      label: "DAYLIGHT"
      value: row.reading ? Sun.formatDuration(row.reading.daylightMs) : "-"
      caption: row.reading && !row.reading.polar ? Sun.formatDelta(row.reading.daylightDeltaMs) + " vs yesterday" : ""
    }
    Stat {
      bar: row.bar
      label: "MOON"
      value: row.reading ? row.reading.moon.glyph + " " + Math.round(row.reading.moon.illumination * 100) + "%" : "-"
      caption: row.reading ? row.reading.moon.name.toLowerCase() : ""
    }
    Stat {
      bar: row.bar
      label: "FULL IN"
      value: row.reading ? Math.round(row.reading.moon.daysToFull) + "d" : "-"
    }
  }
}
