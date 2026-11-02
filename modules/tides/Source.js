// Tides module: hourly sea level at the coast spot from the Open-Meteo
// marine API (no key). The model's sea_level_height_msl includes the tide,
// so high and low water are its turning points, refined between the hourly
// samples with a parabola. It is a model, not a harbour tide table: fine
// for planning a session, not for navigation.

var HOUR_MS = 60 * 60 * 1000

function hasCoordinates(lat, lon) {
  return typeof lat === "number" && typeof lon === "number" && !isNaN(lat) && !isNaN(lon)
}

function urls(ctx) {
  var spot = ctx && ctx.spot
  if (!spot || !hasCoordinates(spot.latitude, spot.longitude)) return []
  return ["https://marine-api.open-meteo.com/v1/marine"
    + "?latitude=" + spot.latitude + "&longitude=" + spot.longitude
    + "&hourly=sea_level_height_msl&past_days=1&forecast_days=3"
    + "&timeformat=unixtime"]
}

// → { points: [{ at, height }] }, { points: [], inland: true } when the
// spot has no sea data, or null when the fetch failed.
function parse(texts) {
  try {
    var data = JSON.parse(String(texts[0] || ""))
    var hourly = data && data.hourly
    if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.sea_level_height_msl)) return null
    var points = []
    for (var i = 0; i < hourly.time.length; i++) {
      var height = hourly.sea_level_height_msl[i]
      if (typeof hourly.time[i] === "number" && typeof height === "number")
        points.push({ at: hourly.time[i] * 1000, height: height })
    }
    return points.length ? { points: points } : { points: [], inland: true }
  } catch (e) {
    return null
  }
}

// Turning points of the series → [{ kind: "high" | "low", at, height }].
// Each is refined with the parabola through its sample and neighbours.
function extremes(points) {
  var out = []
  for (var i = 1; points && i < points.length - 1; i++) {
    var y0 = points[i - 1].height
    var y1 = points[i].height
    var y2 = points[i + 1].height
    var high = y1 > y0 && y1 >= y2
    var low = y1 < y0 && y1 <= y2
    if (!high && !low) continue
    var denominator = y0 - 2 * y1 + y2
    var offset = denominator === 0 ? 0 : 0.5 * (y0 - y2) / denominator
    var step = points[i + 1].at - points[i].at
    out.push({
      kind: high ? "high" : "low",
      at: Math.round(points[i].at + offset * step),
      height: y1 - 0.25 * (y0 - y2) * offset
    })
  }
  return out
}

// The next high and low after nowMs, plus whether the tide is rising now.
// → { next: [extreme, extreme], rising } (next may be shorter near the end
// of the forecast).
function outlook(data, nowMs) {
  var points = data && data.points ? data.points : []
  var upcoming = extremes(points).filter(function(e) { return e.at > nowMs })
  var rising = upcoming.length ? upcoming[0].kind === "high" : null
  return { next: upcoming.slice(0, 2), rising: rising }
}

// The sea level at nowMs, interpolated between the hourly samples.
function heightAt(data, nowMs) {
  var points = data && data.points ? data.points : []
  for (var i = 1; i < points.length; i++) {
    if (points[i].at < nowMs) continue
    var a = points[i - 1]
    var b = points[i]
    if (a.at > nowMs) return null
    return a.height + (b.height - a.height) * (nowMs - a.at) / (b.at - a.at)
  }
  return null
}

function formatHeight(height, imperial) {
  if (height === null || height === undefined) return "-"
  return imperial ? (height * 3.28084).toFixed(1) + " ft" : height.toFixed(1) + " m"
}

// Pill: arrow for the tide's direction and the time of the next turn.
function compact(data, ctx, nowMs, formatTime) {
  var view = outlook(data, nowMs === undefined ? Date.now() : nowMs)
  if (!view.next.length || !formatTime) return ""
  return (view.rising ? "󰁝 " : "󰁅 ") + formatTime(view.next[0].at)
}

if (typeof module !== "undefined") {
  module.exports = {
    urls: urls,
    parse: parse,
    extremes: extremes,
    outlook: outlook,
    heightAt: heightAt,
    formatHeight: formatHeight,
    compact: compact
  }
}
