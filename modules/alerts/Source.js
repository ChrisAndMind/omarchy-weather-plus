// Weather warnings module: official DWD warnings via Bright Sky
// (api.brightsky.dev, no key). Germany only; elsewhere the API answers 404
// and the row says so.

var SEVERITY_RANK = { minor: 1, moderate: 2, severe: 3, extreme: 4 }

function hasCoordinates(lat, lon) {
  return typeof lat === "number" && typeof lon === "number" && !isNaN(lat) && !isNaN(lon)
}

function urls(ctx) {
  if (!ctx || !hasCoordinates(ctx.latitude, ctx.longitude)) return []
  return ["https://api.brightsky.dev/alerts?lat=" + ctx.latitude + "&lon=" + ctx.longitude]
}

function timestampOrNull(value) {
  var ms = Date.parse(String(value || ""))
  return isNaN(ms) ? null : ms
}

// → { alerts: [{ severity, rank, event, headline, description, onset,
// expires }], area }, most severe first, both languages kept so the row can
// follow the locale. null when the body isn't a Bright Sky answer.
function parse(texts) {
  try {
    var data = JSON.parse(String(texts[0] || ""))
    if (!data || !Array.isArray(data.alerts)) return null
    var alerts = []
    for (var i = 0; i < data.alerts.length; i++) {
      var a = data.alerts[i] || {}
      if (a.status && a.status !== "actual") continue
      var severity = String(a.severity || "minor")
      alerts.push({
        severity: severity,
        rank: SEVERITY_RANK[severity] || 1,
        event: { en: String(a.event_en || ""), de: String(a.event_de || "") },
        headline: { en: String(a.headline_en || ""), de: String(a.headline_de || "") },
        description: { en: String(a.description_en || ""), de: String(a.description_de || "") },
        onset: timestampOrNull(a.onset || a.effective),
        expires: timestampOrNull(a.expires)
      })
    }
    alerts.sort(function(x, y) { return y.rank - x.rank || (x.onset || 0) - (y.onset || 0) })
    var location = data.location || {}
    return { alerts: alerts, area: String(location.name || "") }
  } catch (e) {
    return null
  }
}

// Alerts that haven't expired yet (a cached answer can hold old ones).
function current(data, nowMs) {
  var alerts = data && data.alerts ? data.alerts : []
  return alerts.filter(function(a) { return a.expires === null || a.expires > nowMs })
}

function text(field, language) {
  return (field && (field[language] || field.en || field.de)) || ""
}

// Pill: the warning glyph and count while any warning is active.
function compact(data, ctx, nowMs) {
  var active = current(data, nowMs === undefined ? Date.now() : nowMs)
  if (!active.length) return ""
  return "󰀦" + (active.length > 1 ? " " + active.length : "")
}

if (typeof module !== "undefined") {
  module.exports = {
    urls: urls,
    parse: parse,
    current: current,
    text: text,
    compact: compact
  }
}
