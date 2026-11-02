// Swell module: current swell, sea temperature and wind at the coast spot,
// plus the next 48h of swell height, from the Open-Meteo marine and
// forecast APIs (no key).

var HOUR_MS = 60 * 60 * 1000

function hasCoordinates(lat, lon) {
  return typeof lat === "number" && typeof lon === "number" && !isNaN(lat) && !isNaN(lon)
}

function urls(ctx) {
  var spot = ctx && ctx.spot
  if (!spot || !hasCoordinates(spot.latitude, spot.longitude)) return []
  var at = "?latitude=" + spot.latitude + "&longitude=" + spot.longitude
  return [
    "https://marine-api.open-meteo.com/v1/marine" + at
      + "&current=wave_height,swell_wave_height,swell_wave_period,swell_wave_direction,sea_surface_temperature"
      + "&hourly=swell_wave_height&forecast_days=3&timeformat=unixtime",
    "https://api.open-meteo.com/v1/forecast" + at
      + "&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&timeformat=unixtime"
  ]
}

function numberOrNull(value) {
  return typeof value === "number" && !isNaN(value) ? value : null
}

// [marine body, wind body] → { swellHeight, swellPeriod, swellDirection,
// waveHeight, seaTemp, windSpeed, windDirection, windGusts, forecast:
// [{ at, value }] }, { inland: true } when the spot has no sea data, or
// null when the marine fetch failed. Wind is optional.
function parse(texts) {
  var marine
  try {
    marine = JSON.parse(String(texts[0] || ""))
  } catch (e) {
    return null
  }
  var c = marine && marine.current
  if (!c || typeof c !== "object") return null
  if (numberOrNull(c.swell_wave_height) === null && numberOrNull(c.wave_height) === null) return { inland: true }

  var wind = {}
  try {
    wind = (JSON.parse(String(texts[1] || "")) || {}).current || {}
  } catch (e) {}

  var forecast = []
  var hourly = marine.hourly || {}
  var times = Array.isArray(hourly.time) ? hourly.time : []
  var heights = Array.isArray(hourly.swell_wave_height) ? hourly.swell_wave_height : []
  for (var i = 0; i < times.length; i++)
    if (typeof times[i] === "number" && typeof heights[i] === "number") forecast.push({ at: times[i] * 1000, value: heights[i] })

  return {
    swellHeight: numberOrNull(c.swell_wave_height),
    swellPeriod: numberOrNull(c.swell_wave_period),
    swellDirection: numberOrNull(c.swell_wave_direction),
    waveHeight: numberOrNull(c.wave_height),
    seaTemp: numberOrNull(c.sea_surface_temperature),
    windSpeed: numberOrNull(wind.wind_speed_10m),
    windDirection: numberOrNull(wind.wind_direction_10m),
    windGusts: numberOrNull(wind.wind_gusts_10m),
    forecast: forecast
  }
}

var COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]

// Meteorological degrees (where it comes from) → "WNW".
function compass(degrees) {
  if (degrees === null || degrees === undefined) return ""
  return COMPASS[Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16]
}

function formatMetres(value, imperial) {
  if (value === null || value === undefined) return "-"
  return imperial ? (value * 3.28084).toFixed(1) + " ft" : value.toFixed(1) + " m"
}

function formatSwell(data, imperial) {
  if (!data || data.swellHeight === null) return "-"
  var period = data.swellPeriod === null ? "" : " · " + Math.round(data.swellPeriod) + "s"
  return formatMetres(data.swellHeight, imperial) + period
}

function formatWind(data, imperial) {
  if (!data || data.windSpeed === null) return "-"
  var speed = imperial ? Math.round(data.windSpeed * 0.621371) + " mph" : Math.round(data.windSpeed) + " km/h"
  return speed + (data.windDirection === null ? "" : " " + compass(data.windDirection))
}

function formatSeaTemp(value, imperial) {
  if (value === null || value === undefined) return "-"
  return imperial ? Math.round(value * 9 / 5 + 32) + "°F" : value.toFixed(1) + "°C"
}

function compact(data, ctx) {
  if (!data || data.inland || data.swellHeight === null) return ""
  var imperial = !!(ctx && ctx.imperial)
  var height = imperial ? (data.swellHeight * 3.28084).toFixed(0) + "ft" : data.swellHeight.toFixed(1) + "m"
  return "󰞍 " + height + (data.swellPeriod === null ? "" : " " + Math.round(data.swellPeriod) + "s")
}

if (typeof module !== "undefined") {
  module.exports = {
    urls: urls,
    parse: parse,
    compass: compass,
    formatMetres: formatMetres,
    formatSwell: formatSwell,
    formatWind: formatWind,
    formatSeaTemp: formatSeaTemp,
    compact: compact
  }
}
