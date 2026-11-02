// Sun & moon module, computed locally with no network: sunrise, sunset,
// golden hour, how much daylight today gained on yesterday, and the moon
// phase. Uses the standard sunrise equation (accurate to about a minute
// outside the polar regions) and a mean synodic month for the moon (within
// about a day of the true phase, plenty for a name and a glyph).

var DAY_MS = 24 * 60 * 60 * 1000
var J2000 = 2451545
var RAD = Math.PI / 180

// Sun altitudes (degrees) for each event. -0.833 is the upper limb at the
// horizon after refraction; golden hour runs while the sun is below +6.
var HORIZON = -0.833
var GOLDEN = 6

function hasCoordinates(lat, lon) {
  return typeof lat === "number" && typeof lon === "number" && !isNaN(lat) && !isNaN(lon)
}

function toJulian(ms) { return ms / DAY_MS + 2440587.5 }
function fromJulian(j) { return (j - 2440587.5) * DAY_MS }

// Times (ms) when the sun crosses `altitude` on the local solar day
// containing dayMs at longitude `lon`. → { rise, set } or
// { rise: null, set: null, polar: "day" | "night" } when it never does.
function crossings(dayMs, lat, lon, altitude) {
  var n = Math.round(toJulian(dayMs) - J2000 - 0.0009 + lon / 360)
  var jStar = n + 0.0009 - lon / 360
  var m = (357.5291 + 0.98560028 * jStar) % 360
  var c = 1.9148 * Math.sin(m * RAD) + 0.02 * Math.sin(2 * m * RAD) + 0.0003 * Math.sin(3 * m * RAD)
  var lambda = (m + c + 180 + 102.9372) % 360
  var transit = J2000 + jStar + 0.0053 * Math.sin(m * RAD) - 0.0069 * Math.sin(2 * lambda * RAD)
  var sinDecl = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD)
  var cosDecl = Math.cos(Math.asin(sinDecl))
  var cosHour = (Math.sin(altitude * RAD) - Math.sin(lat * RAD) * sinDecl) / (Math.cos(lat * RAD) * cosDecl)
  if (cosHour > 1) return { rise: null, set: null, polar: "night" }
  if (cosHour < -1) return { rise: null, set: null, polar: "day" }
  var hour = Math.acos(cosHour) / RAD / 360
  return { rise: fromJulian(transit - hour), set: fromJulian(transit + hour), polar: "" }
}

function daylightMs(times) {
  if (times.polar === "day") return DAY_MS
  if (times.polar === "night") return 0
  return times.set - times.rise
}

// Moon phase as a fraction of the synodic month: 0 new, 0.25 first
// quarter, 0.5 full, 0.75 last quarter. Reference: new moon 2000-01-06
// 18:14 UTC.
var SYNODIC_DAYS = 29.530588853
var NEW_MOON_JD = 2451550.26

function moonPhase(nowMs) {
  var phase = ((toJulian(nowMs) - NEW_MOON_JD) / SYNODIC_DAYS) % 1
  return phase < 0 ? phase + 1 : phase
}

function moonIllumination(phase) {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2
}

// Eight named phases; the four principal ones get ±1 day around their
// exact instant, the in-between phases fill the rest.
var MOON_NAMES = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous",
  "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"]
// nf-md-moon_* glyphs, same order as MOON_NAMES.
var MOON_GLYPHS = ["󰽤", "󰽧", "󰽡", "󰽨", "󰽢", "󰽦", "󰽣", "󰽥"]

function moonPhaseIndex(phase) {
  var window = 1 / SYNODIC_DAYS
  var principal = [0, 0.25, 0.5, 0.75, 1]
  for (var i = 0; i < principal.length; i++)
    if (Math.abs(phase - principal[i]) <= window) return (i * 2) % 8
  return Math.floor(phase * 4) * 2 + 1
}

// Days until the next full moon (fractional).
function daysToFull(phase) {
  var remaining = 0.5 - phase
  if (remaining < 0) remaining += 1
  return remaining * SYNODIC_DAYS
}

function urls() { return [] }

// → { sunrise, sunset, goldenStart, goldenEnd, polar, daylightMs,
// daylightDeltaMs, moon: { phase, illumination, name, glyph, daysToFull } }
// or null without a location. goldenStart/End are the evening golden hour.
function compute(ctx, nowMs) {
  if (!ctx || !hasCoordinates(ctx.latitude, ctx.longitude)) return null
  var today = crossings(nowMs, ctx.latitude, ctx.longitude, HORIZON)
  var yesterday = crossings(nowMs - DAY_MS, ctx.latitude, ctx.longitude, HORIZON)
  var golden = crossings(nowMs, ctx.latitude, ctx.longitude, GOLDEN)
  var phase = moonPhase(nowMs)
  var index = moonPhaseIndex(phase)
  return {
    sunrise: today.rise,
    sunset: today.set,
    goldenStart: golden.set,
    goldenEnd: today.set,
    polar: today.polar,
    daylightMs: daylightMs(today),
    daylightDeltaMs: daylightMs(today) - daylightMs(yesterday),
    moon: {
      phase: phase,
      illumination: moonIllumination(phase),
      name: MOON_NAMES[index],
      glyph: MOON_GLYPHS[index],
      daysToFull: daysToFull(phase)
    }
  }
}

function formatDuration(ms) {
  var minutes = Math.round(Math.abs(ms) / 60000)
  return Math.floor(minutes / 60) + "h " + (minutes % 60) + "m"
}

// "+2m 14s" / "−1m 50s" against yesterday.
function formatDelta(ms) {
  var seconds = Math.round(Math.abs(ms) / 1000)
  var sign = ms < 0 ? "−" : "+"
  return sign + Math.floor(seconds / 60) + "m " + (seconds % 60) + "s"
}

// The next sun event after nowMs: { kind: "sunrise" | "sunset", at } or null.
function nextEvent(data, nowMs) {
  if (!data || data.polar) return null
  if (nowMs < data.sunrise) return { kind: "sunrise", at: data.sunrise }
  if (nowMs < data.sunset) return { kind: "sunset", at: data.sunset }
  return null
}

// Pill: the next sunrise/sunset time. formatTime is injected because QML
// formats in the system locale; node tests pass their own.
function compact(data, ctx, nowMs, formatTime) {
  var next = nextEvent(data, nowMs === undefined ? Date.now() : nowMs)
  if (!next || !formatTime) return ""
  return (next.kind === "sunrise" ? "󰖜 " : "󰖛 ") + formatTime(next.at)
}

if (typeof module !== "undefined") {
  module.exports = {
    crossings: crossings,
    moonPhase: moonPhase,
    moonPhaseIndex: moonPhaseIndex,
    moonIllumination: moonIllumination,
    urls: urls,
    compute: compute,
    formatDuration: formatDuration,
    formatDelta: formatDelta,
    nextEvent: nextEvent,
    compact: compact
  }
}
