// Rain radar module: precipitation in 15-minute steps for the next two
// hours from Open-Meteo (no key), summed up as "rain in 30 min" or
// "stops in ~45 min".

var STEPS = 8
var STEP_MS = 15 * 60 * 1000
// Below this per-step amount (mm) a step counts as dry; drizzle models
// report a lot of 0.01–0.05 mm noise.
var WET_MM = 0.1

function hasCoordinates(lat, lon) {
  return typeof lat === "number" && typeof lon === "number" && !isNaN(lat) && !isNaN(lon)
}

function urls(ctx) {
  if (!ctx || !hasCoordinates(ctx.latitude, ctx.longitude)) return []
  return ["https://api.open-meteo.com/v1/forecast"
    + "?latitude=" + ctx.latitude + "&longitude=" + ctx.longitude
    + "&minutely_15=precipitation&forecast_minutely_15=" + STEPS
    + "&timeformat=unixtime"]
}

// → { steps: [{ at, mm }] } with `at` in ms, or null.
function parse(texts) {
  try {
    var data = JSON.parse(String(texts[0] || ""))
    var series = data && data.minutely_15
    if (!series || !Array.isArray(series.time) || !Array.isArray(series.precipitation)) return null
    var steps = []
    for (var i = 0; i < series.time.length; i++) {
      var mm = series.precipitation[i]
      if (typeof series.time[i] !== "number" || typeof mm !== "number") continue
      steps.push({ at: series.time[i] * 1000, mm: mm })
    }
    return steps.length ? { steps: steps } : null
  } catch (e) {
    return null
  }
}

// Steps still ahead of (or covering) nowMs.
function upcoming(data, nowMs) {
  var steps = data && data.steps ? data.steps : []
  return steps.filter(function(step) { return step.at + STEP_MS > nowMs })
}

// → { state: "dry" | "starts" | "raining", minutes, totalMm }:
//   starts:  rain begins in `minutes`
//   raining: wet now; stops in `minutes`, or keeps going (minutes null)
function summarize(data, nowMs) {
  var steps = upcoming(data, nowMs)
  var total = 0
  for (var i = 0; i < steps.length; i++) total += steps[i].mm
  var minutesUntil = function(at) { return Math.max(0, Math.round((at - nowMs) / 60000)) }

  if (!steps.length) return { state: "dry", minutes: null, totalMm: 0 }
  if (steps[0].mm >= WET_MM) {
    for (var j = 1; j < steps.length; j++)
      if (steps[j].mm < WET_MM) return { state: "raining", minutes: minutesUntil(steps[j].at), totalMm: total }
    return { state: "raining", minutes: null, totalMm: total }
  }
  for (var k = 1; k < steps.length; k++)
    if (steps[k].mm >= WET_MM) return { state: "starts", minutes: minutesUntil(steps[k].at), totalMm: total }
  return { state: "dry", minutes: null, totalMm: total }
}

function describe(summary) {
  if (summary.state === "starts") return "Rain in " + summary.minutes + " min"
  if (summary.state === "raining")
    return summary.minutes === null ? "Raining for the next 2 h" : "Raining · stops in ~" + summary.minutes + " min"
  return "Dry for the next 2 h"
}

// One block glyph per step, scaled to the wettest step (at least 2 mm, so
// a drizzle doesn't draw as a downpour).
var BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]

function sparkline(data, nowMs) {
  var steps = upcoming(data, nowMs)
  var max = 2
  for (var i = 0; i < steps.length; i++) max = Math.max(max, steps[i].mm)
  var out = ""
  for (var j = 0; j < steps.length; j++) {
    var level = steps[j].mm < WET_MM ? 0 : Math.max(1, Math.round(steps[j].mm / max * (BLOCKS.length - 1)))
    out += BLOCKS[level]
  }
  return out
}

// Pill: only when there's something to say.
function compact(data, ctx, nowMs) {
  var summary = summarize(data, nowMs === undefined ? Date.now() : nowMs)
  if (summary.state === "starts") return "󰖗 " + summary.minutes + "'"
  if (summary.state === "raining") return "󰖗"
  return ""
}

if (typeof module !== "undefined") {
  module.exports = {
    WET_MM: WET_MM,
    urls: urls,
    parse: parse,
    summarize: summarize,
    describe: describe,
    sparkline: sparkline,
    compact: compact
  }
}
