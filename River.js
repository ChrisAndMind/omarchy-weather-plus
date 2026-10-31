// Eisbach water temperature and flow, shown in the weather popup.
//
// The cache file (river.json) holds the last non-null reading per field as
// {"temperatureC": {"value": 14.2, "at": <ms>}, "flowM3s": {...}}. When the
// API returns null for a field (or fails outright), the cached value is shown
// as stale for up to STALE_LIMIT_MS; after that the field displays "-".

var FIELDS = ["temperatureC", "flowM3s"]
var STALE_LIMIT_MS = 24 * 60 * 60 * 1000

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null
  var n = parseFloat(String(value))
  return isNaN(n) ? null : n
}

function timestampOrNull(value) {
  if (value === undefined || value === null || value === "") return null
  var ms = typeof value === "number" ? value : Date.parse(String(value))
  return isNaN(ms) ? null : ms
}

// eisbach.chrisvb.dev /api/current → { temperatureC, flowM3s, measuredAt,
// at }, where `at` holds each field's own measurement time (the temperature
// gauge reports separately from the flow gauge). A metric is null when its
// gauge hasn't reported in a while; missing or non-numeric values become
// null, as does everything when the body is empty or not JSON.
function parseRiverResponse(raw) {
  var empty = { temperatureC: null, flowM3s: null, measuredAt: null, at: {} }
  try {
    var data = JSON.parse(String(raw || ""))
    var current = data && data.current
    if (!current || typeof current !== "object") return empty
    var metrics = current.metrics || {}
    var temperature = metrics.wassertemperatur || {}
    var flow = metrics.abfluss || {}
    return {
      temperatureC: numberOrNull(temperature.value),
      flowM3s: numberOrNull(flow.value),
      measuredAt: timestampOrNull(current.observed_at),
      at: { temperatureC: timestampOrNull(temperature.ts), flowM3s: timestampOrNull(flow.ts) }
    }
  } catch (e) {
    return empty
  }
}

// /api/history?metric=abfluss&range=7d&bucket=hour → [{at, value}], oldest
// first. Points with a missing time or value are dropped (the chart shows a
// gap there); an unusable body yields null so callers can keep what they had.
function parseFlowHistory(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    if (!data || !Array.isArray(data.points)) return null
    var out = []
    for (var i = 0; i < data.points.length; i++) {
      var point = data.points[i] || {}
      var at = timestampOrNull(point.ts)
      var value = numberOrNull(point.value)
      if (at !== null && value !== null) out.push({ at: at, value: value })
    }
    return out
  } catch (e) {
    return null
  }
}

function parseCacheFile(raw) {
  var cache = {}
  try {
    var data = JSON.parse(String(raw || ""))
    if (!data || typeof data !== "object") return cache
    for (var i = 0; i < FIELDS.length; i++) {
      var entry = data[FIELDS[i]]
      if (!entry || typeof entry !== "object") continue
      var value = numberOrNull(entry.value)
      var at = timestampOrNull(entry.at)
      if (value !== null && at !== null) cache[FIELDS[i]] = { value: value, at: at }
    }
  } catch (e) {}
  return cache
}

// Combine a fresh reading (or null when the fetch failed) with the cache.
// Each field is resolved on its own: a fresh value wins and is recorded at
// its own measurement time (falling back to measuredAt, then now);
// otherwise a cached value younger than STALE_LIMIT_MS is shown as stale;
// otherwise the field is null. Returns { display, cache } where display maps
// each field to { value, stale, ageMs } or null.
function mergeRiverReading(fresh, cache, nowMs) {
  var reading = fresh || {}
  var previous = cache || {}
  var fieldAt = reading.at || {}

  var display = {}
  var nextCache = {}
  for (var i = 0; i < FIELDS.length; i++) {
    var field = FIELDS[i]
    var value = numberOrNull(reading[field])
    var cached = previous[field]

    if (value !== null) {
      var recordedAt = timestampOrNull(fieldAt[field])
      if (recordedAt === null) recordedAt = timestampOrNull(reading.measuredAt)
      if (recordedAt === null || recordedAt > nowMs) recordedAt = nowMs
      nextCache[field] = { value: value, at: recordedAt }
      display[field] = { value: value, stale: false, ageMs: nowMs - recordedAt }
      continue
    }

    if (cached) nextCache[field] = cached
    var ageMs = cached ? nowMs - cached.at : Infinity
    display[field] = ageMs < STALE_LIMIT_MS ? { value: cached.value, stale: true, ageMs: ageMs } : null
  }
  return { display: display, cache: nextCache }
}

function formatRiverTemp(entry, useImperial) {
  if (!entry) return "-"
  var value = useImperial ? (entry.value * 9 / 5) + 32 : entry.value
  return value.toFixed(1) + "°" + (useImperial ? "F" : "C")
}

function formatRiverFlow(entry) {
  if (!entry) return "-"
  return entry.value.toFixed(1) + " m³/s"
}

function formatAge(ms) {
  var minutes = Math.floor(Math.max(0, ms) / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return minutes + "m ago"
  return Math.floor(minutes / 60) + "h ago"
}

// ---- Weekly flow trend, drawn as a braille-dot plot. Each braille cell is
//      2 dot columns × 4 dot rows, so a chart `chars` wide and `rows` tall
//      has chars*2 time buckets and rows*4 value levels.

var CHART_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// Dot bit per [column][row] within a cell, row 0 at the top (Unicode
// braille numbering: dots 1-2-3-7 down the left, 4-5-6-8 down the right).
var BRAILLE_DOTS = [[0x01, 0x02, 0x04, 0x40], [0x08, 0x10, 0x20, 0x80]]

// [{at, value}] → `count` evenly spaced buckets over [startMs, endMs), each
// the mean of its points or null when it has none (drawn as a gap).
function bucketSeries(points, startMs, endMs, count) {
  var sums = []
  var counts = []
  for (var i = 0; i < count; i++) { sums.push(0); counts.push(0) }

  var span = endMs - startMs
  for (var j = 0; points && j < points.length; j++) {
    var at = timestampOrNull(points[j] && points[j].at)
    var value = numberOrNull(points[j] && points[j].value)
    if (at === null || value === null || at < startMs || at >= endMs) continue
    var index = Math.min(count - 1, Math.floor((at - startMs) / span * count))
    sums[index] += value
    counts[index]++
  }

  var out = []
  for (var k = 0; k < count; k++) out.push(counts[k] ? sums[k] / counts[k] : null)
  return out
}

// Bucket values → braille text lines, top line first. Consecutive buckets
// are joined by a vertical run of dots so the trace reads as a line; a null
// bucket breaks it. A flat series sits mid-height.
function brailleChart(values, rows) {
  var chars = Math.ceil(values.length / 2)
  var levels = rows * 4
  var grid = []
  for (var r = 0; r < rows; r++) {
    var line = []
    for (var c = 0; c < chars; c++) line.push(0)
    grid.push(line)
  }

  var min = Infinity
  var max = -Infinity
  for (var i = 0; i < values.length; i++) {
    if (values[i] === null) continue
    min = Math.min(min, values[i])
    max = Math.max(max, values[i])
  }

  function yFor(value) {
    if (max === min) return Math.floor(levels / 2)
    return levels - 1 - Math.round((value - min) / (max - min) * (levels - 1))
  }

  var prevY = null
  for (var x = 0; x < values.length; x++) {
    if (values[x] === null) { prevY = null; continue }
    var y = yFor(values[x])
    var from = prevY === null ? y : Math.min(prevY, y)
    var to = prevY === null ? y : Math.max(prevY, y)
    for (var dotY = from; dotY <= to; dotY++)
      grid[Math.floor(dotY / 4)][Math.floor(x / 2)] |= BRAILLE_DOTS[x % 2][dotY % 4]
    prevY = y
  }

  var lines = []
  for (var row = 0; row < rows; row++) {
    var text = ""
    for (var col = 0; col < chars; col++) text += String.fromCharCode(0x2800 + grid[row][col])
    lines.push(text)
  }
  return { lines: lines, min: min === Infinity ? null : min, max: max === -Infinity ? null : max }
}

// A `chars`-wide axis line with a day label (from labelFor(date)) at the
// column where each local day starts. The partial first day is labelled
// at column 0; a label without two spaces before the next one is dropped.
function dayAxis(startMs, endMs, chars, labelFor) {
  var starts = [{ index: 0, date: new Date(startMs) }]
  var day = new Date(startMs)
  day.setHours(24, 0, 0, 0)
  for (; day.getTime() < endMs; day.setDate(day.getDate() + 1))
    starts.push({ index: Math.floor((day.getTime() - startMs) / (endMs - startMs) * chars), date: new Date(day.getTime()) })

  var axis = []
  for (var i = 0; i < chars; i++) axis.push(" ")
  for (var j = 0; j < starts.length; j++) {
    var label = String(labelFor(starts[j].date))
    // Last column this label may use: two spaces short of the next label,
    // or the end of the axis.
    var limit = j + 1 < starts.length ? starts[j + 1].index - 3 : chars - 1
    if (starts[j].index + label.length - 1 > limit) continue
    for (var k = 0; k < label.length; k++) axis[starts[j].index + k] = label[k]
  }
  return axis.join("")
}

function formatFlowRange(min, max) {
  if (min === null || max === null) return ""
  return min.toFixed(1) + "–" + max.toFixed(1) + " m³/s"
}

if (typeof module !== "undefined") {
  module.exports = {
    CHART_WINDOW_MS: CHART_WINDOW_MS,
    bucketSeries: bucketSeries,
    brailleChart: brailleChart,
    dayAxis: dayAxis,
    formatFlowRange: formatFlowRange,
    STALE_LIMIT_MS: STALE_LIMIT_MS,
    parseRiverResponse: parseRiverResponse,
    parseFlowHistory: parseFlowHistory,
    parseCacheFile: parseCacheFile,
    mergeRiverReading: mergeRiverReading,
    formatRiverTemp: formatRiverTemp,
    formatRiverFlow: formatRiverFlow,
    formatAge: formatAge
  }
}
