// Last-good values for module data. Each module's cache file holds
// {"value": <parsed data>, "at": <ms>}. When a fetch fails, the cached value
// is shown as stale for up to STALE_LIMIT_MS; after that the module shows
// nothing rather than old data.
//
// Modules whose data needs finer staleness (Eisbach's two gauges) supply
// their own parseCache/merge with the same shape as the ones here.

var STALE_LIMIT_MS = 24 * 60 * 60 * 1000

function parseCache(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    if (!data || typeof data !== "object" || data.value === undefined || data.value === null) return null
    var at = typeof data.at === "number" ? data.at : NaN
    return isNaN(at) ? null : { value: data.value, at: at }
  } catch (e) {
    return null
  }
}

// Combine a fresh parse (null when the fetch or parse failed) with the
// cache. Returns { display, cache }: display is { value, stale, ageMs } or
// null, cache is what to persist (unchanged when the fetch failed).
function merge(fresh, cache, nowMs) {
  if (fresh !== null && fresh !== undefined) {
    return {
      display: { value: fresh, stale: false, ageMs: 0 },
      cache: { value: fresh, at: nowMs }
    }
  }
  if (!cache) return { display: null, cache: null }
  var ageMs = nowMs - cache.at
  return {
    display: ageMs < STALE_LIMIT_MS ? { value: cache.value, stale: true, ageMs: ageMs } : null,
    cache: cache
  }
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
    parseCache: parseCache,
    merge: merge,
    formatAge: formatAge
  }
}
