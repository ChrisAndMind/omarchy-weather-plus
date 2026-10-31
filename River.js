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

// API response → { temperatureC, flowM3s, measuredAt }. This is the only
// API-specific code. Missing, null, or non-numeric fields become null, as
// does everything when the body is empty or not JSON.
// TODO(api spec): the field names below are placeholders until the river
// API's real response shape is known.
function parseRiverResponse(raw) {
  var empty = { temperatureC: null, flowM3s: null, measuredAt: null }
  try {
    var data = JSON.parse(String(raw || ""))
    if (!data || typeof data !== "object") return empty
    return {
      temperatureC: numberOrNull(data.waterTemperature),
      flowM3s: numberOrNull(data.flow),
      measuredAt: timestampOrNull(data.measuredAt)
    }
  } catch (e) {
    return empty
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
// Each field is resolved on its own: a fresh value wins and is recorded;
// otherwise a cached value younger than STALE_LIMIT_MS is shown as stale;
// otherwise the field is null. Returns { display, cache } where display maps
// each field to { value, stale, ageMs } or null.
function mergeRiverReading(fresh, cache, nowMs) {
  var reading = fresh || {}
  var previous = cache || {}
  var recordedAt = timestampOrNull(reading.measuredAt)
  if (recordedAt === null || recordedAt > nowMs) recordedAt = nowMs

  var display = {}
  var nextCache = {}
  for (var i = 0; i < FIELDS.length; i++) {
    var field = FIELDS[i]
    var value = numberOrNull(reading[field])
    var cached = previous[field]

    if (value !== null) {
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

if (typeof module !== "undefined") {
  module.exports = {
    STALE_LIMIT_MS: STALE_LIMIT_MS,
    parseRiverResponse: parseRiverResponse,
    parseCacheFile: parseCacheFile,
    mergeRiverReading: mergeRiverReading,
    formatRiverTemp: formatRiverTemp,
    formatRiverFlow: formatRiverFlow,
    formatAge: formatAge
  }
}
