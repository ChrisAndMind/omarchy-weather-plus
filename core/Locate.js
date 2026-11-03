// Where the weather is for, when no location is configured. Weather+ asks
// ipinfo.io (HTTPS, no key) for the city of the current IP address; if that
// fails it falls back to the principal city of the system timezone from
// tzdata's zone1970.tab, which works offline and sends nothing anywhere.
// Both give { name, latitude, longitude, country, source }, where country
// is an ISO 3166 code and source is "ip" or "timezone".

var IPINFO_URL = "https://ipinfo.io/json"

// Re-ask ipinfo this often, so a laptop that moved picks up its new city.
var DETECT_INTERVAL_MS = 6 * 60 * 60 * 1000

function finite(value) {
  return typeof value === "number" && isFinite(value)
}

function validLocation(location) {
  return !!location && finite(location.latitude) && finite(location.longitude)
    && Math.abs(location.latitude) <= 90 && Math.abs(location.longitude) <= 180
}

// ipinfo.io/json → location, null when the response has no usable "loc".
function parseIpinfo(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    var parts = String(data.loc || "").split(",")
    if (parts.length !== 2) return null
    var location = {
      name: typeof data.city === "string" ? data.city : "",
      latitude: parseFloat(parts[0]),
      longitude: parseFloat(parts[1]),
      country: typeof data.country === "string" ? data.country : "",
      source: "ip"
    }
    return validLocation(location) ? location : null
  } catch (e) {
    return null
  }
}

// ISO 6709 as zone1970.tab writes it: ±DDMM±DDDMM or ±DDMMSS±DDDMMSS.
function parseIso6709(text) {
  var m = /^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$/.exec(String(text || ""))
  if (!m) return null
  function degrees(sign, d, mi, s) {
    var value = parseInt(d, 10) + parseInt(mi, 10) / 60 + (s ? parseInt(s, 10) / 3600 : 0)
    return sign === "-" ? -value : value
  }
  return {
    latitude: degrees(m[1], m[2], m[3], m[4]),
    longitude: degrees(m[5], m[6], m[7], m[8])
  }
}

// "/usr/share/zoneinfo/Europe/Berlin" or "../usr/share/zoneinfo/posix/Europe/Berlin"
// (the /etc/localtime symlink) → "Europe/Berlin".
function zoneFromLocaltime(link) {
  var path = String(link || "").replace(/^\s+|\s+$/g, "")
  var at = path.lastIndexOf("zoneinfo/")
  if (at === -1) return ""
  return path.slice(at + "zoneinfo/".length).replace(/^(posix|right)\//, "")
}

// The timezone's principal city from zone1970.tab, null when the zone isn't
// listed (UTC, Etc/*).
function timezoneLocation(zone, zoneTab) {
  if (!zone) return null
  var lines = String(zoneTab || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].charAt(0) === "#") continue
    var columns = lines[i].split("\t")
    if (columns.length < 3 || columns[2] !== zone) continue
    var coords = parseIso6709(columns[1])
    if (!coords) return null
    var city = zone.slice(zone.lastIndexOf("/") + 1).replace(/_/g, " ")
    return {
      name: city,
      latitude: coords.latitude,
      longitude: coords.longitude,
      country: columns[0].split(",")[0],
      source: "timezone"
    }
  }
  return null
}

// The stored detection (weather-plus-location.json), null if unusable.
function parseStored(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    if (!validLocation(data)) return null
    return {
      name: typeof data.name === "string" ? data.name : "",
      latitude: data.latitude,
      longitude: data.longitude,
      country: typeof data.country === "string" ? data.country : "",
      source: data.source === "timezone" ? "timezone" : "ip",
      at: finite(data.at) ? data.at : 0
    }
  } catch (e) {
    return null
  }
}

// An IP lookup is always better than the timezone guess, so the guess only
// fills in when nothing better is known.
function preferred(current, candidate) {
  if (!validLocation(candidate)) return current
  if (!validLocation(current) || candidate.source === "ip") return candidate
  return current.source === "timezone" ? candidate : current
}

if (typeof module !== "undefined") {
  module.exports = {
    IPINFO_URL: IPINFO_URL,
    DETECT_INTERVAL_MS: DETECT_INTERVAL_MS,
    parseIpinfo: parseIpinfo,
    parseIso6709: parseIso6709,
    zoneFromLocaltime: zoneFromLocaltime,
    timezoneLocation: timezoneLocation,
    parseStored: parseStored,
    preferred: preferred
  }
}
