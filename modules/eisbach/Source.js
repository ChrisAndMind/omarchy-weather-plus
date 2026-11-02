// Eisbach module: water temperature and flow in Munich, from
// eisbach.chrisvb.dev (no key), with a 7-day flow trend.
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

function formatFlowRange(min, max) {
  if (min === null || max === null) return ""
  return min.toFixed(1) + "–" + max.toFixed(1) + " m³/s"
}

// ---- Module contract (see modules/Registry.js).

var CURRENT_URL = "https://eisbach.chrisvb.dev/api/current"
var HISTORY_URL = "https://eisbach.chrisvb.dev/api/history?metric=abfluss&range=7d&bucket=hour"
var HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// The gauge is fixed, so the weather location doesn't matter.
function urls(ctx) {
  return [CURRENT_URL, HISTORY_URL]
}

// [current body, history body] → { reading, history }. Never null: a failed
// current fetch is a reading of nulls, which merge() resolves per field
// against the cache; a failed history fetch is a null history.
function parse(texts, ctx) {
  return {
    reading: parseRiverResponse(texts[0]),
    history: parseFlowHistory(texts[1])
  }
}

// river.json-style per-field cache plus the last good flow history:
// { fields: { temperatureC: {value, at}, ... }, history: [{at, value}] }.
function parseCache(raw) {
  var cache = { fields: {}, history: [] }
  try {
    var data = JSON.parse(String(raw || ""))
    if (!data || typeof data !== "object") return cache
    cache.fields = parseCacheFile(JSON.stringify(data.fields || {}))
    var history = parseFlowHistory(JSON.stringify({ points: (data.history || []).map(function(p) { return { ts: p.at, value: p.value } }) }))
    if (history) cache.history = history
  } catch (e) {}
  return cache
}

// Staleness is tracked per field (the two gauges report separately), so
// the module-level entry is never stale itself. A failed history fetch
// keeps the previous week rather than blanking the chart.
function merge(fresh, cache, nowMs) {
  var previous = cache || { fields: {}, history: [] }
  var merged = mergeRiverReading(fresh ? fresh.reading : null, previous.fields, nowMs)
  var history = fresh && fresh.history ? fresh.history : (previous.history || [])
  return {
    display: {
      value: { temperatureC: merged.display.temperatureC, flowM3s: merged.display.flowM3s, history: history },
      stale: false,
      ageMs: 0
    },
    cache: { fields: merged.cache, history: history }
  }
}

function compact(value, ctx) {
  if (!value || !value.temperatureC) return ""
  return "󰖌 " + formatRiverTemp(value.temperatureC, ctx && ctx.imperial)
}

if (typeof module !== "undefined") {
  module.exports = {
    formatFlowRange: formatFlowRange,
    STALE_LIMIT_MS: STALE_LIMIT_MS,
    parseRiverResponse: parseRiverResponse,
    parseFlowHistory: parseFlowHistory,
    parseCacheFile: parseCacheFile,
    mergeRiverReading: mergeRiverReading,
    formatRiverTemp: formatRiverTemp,
    formatRiverFlow: formatRiverFlow,
    HISTORY_WINDOW_MS: HISTORY_WINDOW_MS,
    urls: urls,
    parse: parse,
    parseCache: parseCache,
    merge: merge,
    compact: compact
  }
}
