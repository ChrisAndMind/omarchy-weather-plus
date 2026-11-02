// Air & pollen module: European air quality index, UV index and pollen
// from the Open-Meteo air quality API (no key). Pollen is modelled for
// Europe only; elsewhere those values are null and the row leaves them out.

var POLLEN = [
  { key: "alder_pollen", name: "Alder" },
  { key: "birch_pollen", name: "Birch" },
  { key: "grass_pollen", name: "Grass" },
  { key: "mugwort_pollen", name: "Mugwort" },
  { key: "olive_pollen", name: "Olive" },
  { key: "ragweed_pollen", name: "Ragweed" }
]

function hasCoordinates(lat, lon) {
  return typeof lat === "number" && typeof lon === "number" && !isNaN(lat) && !isNaN(lon)
}

function urls(ctx) {
  if (!ctx || !hasCoordinates(ctx.latitude, ctx.longitude)) return []
  var fields = ["european_aqi", "uv_index"].concat(POLLEN.map(function(p) { return p.key }))
  return ["https://air-quality-api.open-meteo.com/v1/air-quality"
    + "?latitude=" + ctx.latitude + "&longitude=" + ctx.longitude
    + "&current=" + fields.join(",")
    + "&timeformat=unixtime"]
}

function numberOrNull(value) {
  return typeof value === "number" && !isNaN(value) ? value : null
}

// → { aqi, uv, pollen: [{ name, value }] } (pollen with data, strongest
// first), or null.
function parse(texts) {
  try {
    var data = JSON.parse(String(texts[0] || ""))
    var c = data && data.current
    if (!c || typeof c !== "object") return null
    var pollen = []
    for (var i = 0; i < POLLEN.length; i++) {
      var value = numberOrNull(c[POLLEN[i].key])
      if (value !== null) pollen.push({ name: POLLEN[i].name, value: value })
    }
    pollen.sort(function(a, b) { return b.value - a.value })
    return { aqi: numberOrNull(c.european_aqi), uv: numberOrNull(c.uv_index), pollen: pollen }
  } catch (e) {
    return null
  }
}

// EEA bands for the European AQI.
function aqiBand(aqi) {
  if (aqi === null || aqi === undefined) return ""
  if (aqi <= 20) return "good"
  if (aqi <= 40) return "fair"
  if (aqi <= 60) return "moderate"
  if (aqi <= 80) return "poor"
  if (aqi <= 100) return "very poor"
  return "extremely poor"
}

// WHO UV index bands.
function uvBand(uv) {
  if (uv === null || uv === undefined) return ""
  if (uv < 3) return "low"
  if (uv < 6) return "moderate"
  if (uv < 8) return "high"
  if (uv < 11) return "very high"
  return "extreme"
}

// Rough grains/m³ levels, close to what German pollen services use for
// tree and grass pollen.
function pollenLevel(value) {
  if (value === null || value === undefined || value < 1) return "none"
  if (value < 10) return "low"
  if (value < 50) return "moderate"
  return "high"
}

// The strongest pollen worth mentioning, or null when everything is quiet.
function topPollen(data) {
  var top = data && data.pollen && data.pollen[0]
  return top && pollenLevel(top.value) !== "none" ? top : null
}

function compact(data) {
  if (!data || data.aqi === null) return ""
  return "AQI " + Math.round(data.aqi)
}

if (typeof module !== "undefined") {
  module.exports = {
    urls: urls,
    parse: parse,
    aqiBand: aqiBand,
    uvBand: uvBand,
    pollenLevel: pollenLevel,
    topPollen: topPollen,
    compact: compact
  }
}
