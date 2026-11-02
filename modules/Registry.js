// The optional rows under the forecast. Each module lives in
// modules/<id>/ as Source.js (pure data code, tested with node) and Row.qml
// (its panel row). Every module is off by default, so a fresh install looks
// exactly like the stock weather widget; `show<Id>` turns one on.
//
// Source.js contract:
//   urls(ctx)            → [url, …] to fetch, [] when not configured
//   parse(texts, ctx)    → data, or null when the fetch failed
//   compute(ctx, nowMs)  → data, instead of urls/parse for local-only modules
//   compact(data, ctx)   → short text for the bar pill ("" for none)
//   parseCache/merge     → optional, see core/Cache.js
//
// ctx is { latitude, longitude, spot: { name, latitude, longitude },
// imperial, language, settings } — see Panel.qml moduleContext.

var MODULES = [
  {
    id: "alerts",
    title: "Weather warnings",
    description: "Official DWD warnings for your location (Germany only).",
    refreshMinutes: 10
  },
  {
    id: "rain",
    title: "Rain radar",
    description: "When rain starts or stops in the next two hours.",
    refreshMinutes: 10
  },
  {
    id: "air",
    title: "Air & pollen",
    description: "European air quality index, UV and the strongest pollen (Europe).",
    refreshMinutes: 60
  },
  {
    id: "sun",
    title: "Sun & moon",
    description: "Sunrise, sunset, golden hour, daylight gained and the moon phase. Works offline.",
    refreshMinutes: 5
  },
  {
    id: "tides",
    title: "Tides",
    description: "Next high and low tide with a 24h curve, at your coast spot.",
    refreshMinutes: 180,
    usesSpot: true
  },
  {
    id: "swell",
    title: "Swell",
    description: "Swell height, period and direction, sea temperature and wind at your coast spot.",
    refreshMinutes: 60,
    usesSpot: true
  },
  {
    id: "eisbach",
    title: "Eisbach",
    description: "Water temperature and flow of Munich's Eisbach, with a 7-day trend.",
    refreshMinutes: 15
  }
]

function settingKey(id) {
  return "show" + id.charAt(0).toUpperCase() + id.slice(1)
}

function find(id) {
  for (var i = 0; i < MODULES.length; i++) if (MODULES[i].id === id) return MODULES[i]
  return null
}

// Booleans arrive from shell.json, and from the Setup form as strings.
function isEnabled(settings, id) {
  var value = settings ? settings[settingKey(id)] : undefined
  return value === true || value === "true"
}

function enabledIds(settings) {
  var ids = []
  for (var i = 0; i < MODULES.length; i++) if (isEnabled(settings, MODULES[i].id)) ids.push(MODULES[i].id)
  return ids
}

function usesSpot(settings) {
  for (var i = 0; i < MODULES.length; i++) if (MODULES[i].usesSpot && isEnabled(settings, MODULES[i].id)) return true
  return false
}

// The module shown beside the bar icon, or "" for none. A disabled module
// never shows, so turning a module off can't leave stale text in the bar.
function pillModule(settings) {
  var id = String(settings && settings.pillModule || "")
  return find(id) && isEnabled(settings, id) ? id : ""
}

if (typeof module !== "undefined") {
  module.exports = {
    MODULES: MODULES,
    settingKey: settingKey,
    find: find,
    isEnabled: isEnabled,
    enabledIds: enabledIds,
    usesSpot: usesSpot,
    pillModule: pillModule
  }
}
