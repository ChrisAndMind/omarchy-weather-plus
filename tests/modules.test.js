const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const Rain = require('../modules/rain/Source.js')
const Alerts = require('../modules/alerts/Source.js')
const Air = require('../modules/air/Source.js')
const Sun = require('../modules/sun/Source.js')
const Tides = require('../modules/tides/Source.js')
const Swell = require('../modules/swell/Source.js')

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
const MIN = 60 * 1000
const HOUR = 60 * MIN
const MUNICH = { latitude: 48.137, longitude: 11.575 }
const hhmm = (ms) => new Date(ms).toISOString().slice(11, 16)

// ---- Rain

const T0 = Date.UTC(2026, 10, 2, 14, 45)
const rainBody = (mm) => JSON.stringify({ minutely_15: { time: mm.map((_, i) => (T0 + i * 15 * MIN) / 1000), precipitation: mm } })

test('rain needs a location', () => {
  assert.deepStrictEqual(Rain.urls({}), [])
  assert.match(Rain.urls(MUNICH)[0], /minutely_15=precipitation.*timeformat=unixtime/)
})

test('rain: dry, starts, raining and stopping', () => {
  const at = T0 + 5 * MIN
  const dry = Rain.parse([rainBody([0, 0.02, 0, 0, 0, 0, 0, 0])])
  assert.deepStrictEqual(Rain.summarize(dry, at), { state: 'dry', minutes: null, totalMm: 0.02 })
  assert.strictEqual(Rain.compact(dry, {}, at), '')

  const starts = Rain.parse([rainBody([0, 0, 0.4, 1.2, 0, 0, 0, 0])])
  const summary = Rain.summarize(starts, at)
  assert.strictEqual(summary.state, 'starts')
  assert.strictEqual(summary.minutes, 25)
  assert.strictEqual(Rain.describe(summary), 'Rain in 25 min')
  assert.strictEqual(Rain.compact(starts, {}, at), "󰖗 25'")

  const stopping = Rain.parse([rainBody([0.5, 0.5, 0, 0, 0, 0, 0, 0])])
  assert.strictEqual(Rain.describe(Rain.summarize(stopping, at)), 'Raining · stops in ~25 min')

  const steady = Rain.parse([rainBody([1, 1, 1, 1, 1, 1, 1, 1])])
  assert.strictEqual(Rain.describe(Rain.summarize(steady, at)), 'Raining for the next 2 h')
})

test('rain: sparkline scales to the wettest step', () => {
  const data = Rain.parse([rainBody([0, 0.2, 1, 4, 0, 0, 0, 0])])
  assert.strictEqual(Rain.sparkline(data, T0), '▁▂▃█▁▁▁▁')
  // Steps already past are dropped.
  assert.strictEqual(Rain.sparkline(data, T0 + 31 * MIN).length, 6)
})

test('rain: unusable bodies fail', () => {
  for (const raw of ['', 'x', '{}', '{"minutely_15": {"time": [], "precipitation": []}}']) assert.strictEqual(Rain.parse([raw]), null, raw)
})

// ---- Alerts

test('alerts: parses DWD warnings from Bright Sky', () => {
  const data = Alerts.parse([fixture('alerts-garmisch.json')])
  assert.strictEqual(data.area, 'Gemeinde Garmisch-Partenkirchen')
  assert.strictEqual(data.alerts.length, 1)
  const frost = data.alerts[0]
  assert.strictEqual(frost.severity, 'minor')
  assert.strictEqual(Alerts.text(frost.headline, 'en'), 'Official WARNING of FROST')
  assert.strictEqual(Alerts.text(frost.headline, 'de'), 'Amtliche WARNUNG vor FROST')
  assert.strictEqual(frost.expires, Date.UTC(2026, 10, 3, 7))
})

test('alerts: most severe first, expired ones dropped, pill counts the rest', () => {
  const alert = (severity, expires) => ({ severity, status: 'actual', headline_en: severity, onset: '2026-11-02T10:00:00Z', expires })
  const data = Alerts.parse([JSON.stringify({ alerts: [alert('minor', '2026-11-03T00:00:00Z'), alert('severe', '2026-11-03T00:00:00Z'), alert('moderate', '2026-11-02T11:00:00Z')] })])
  assert.deepStrictEqual(data.alerts.map((a) => a.severity), ['severe', 'moderate', 'minor'])
  const now = Date.UTC(2026, 10, 2, 12)
  assert.deepStrictEqual(Alerts.current(data, now).map((a) => a.severity), ['severe', 'minor'])
  assert.strictEqual(Alerts.compact(data, {}, now), '󰀦 2')
  assert.strictEqual(Alerts.compact({ alerts: [] }, {}, now), '')
})

test('alerts: outside Germany (404 → empty body) is a failed fetch', () => {
  assert.strictEqual(Alerts.parse(['']), null)
  assert.deepStrictEqual(Alerts.parse(['{"alerts": [], "location": null}']), { alerts: [], area: '' })
})

// ---- Air & pollen

test('air: AQI, UV and pollen from Open-Meteo', () => {
  const data = Air.parse([fixture('air-munich.json')])
  assert.strictEqual(data.aqi, 26)
  assert.strictEqual(Air.aqiBand(data.aqi), 'fair')
  assert.strictEqual(Air.uvBand(data.uv), 'low')
  assert.strictEqual(data.pollen.length, 6)
  assert.strictEqual(Air.topPollen(data), null)
  assert.strictEqual(Air.compact(data), 'AQI 26')
})

test('air: strongest pollen first, missing values left out', () => {
  const body = JSON.stringify({ current: { european_aqi: 55, uv_index: 6.2, birch_pollen: 120, grass_pollen: 8, alder_pollen: null } })
  const data = Air.parse([body])
  assert.deepStrictEqual(data.pollen, [{ name: 'Birch', value: 120 }, { name: 'Grass', value: 8 }])
  assert.deepStrictEqual(Air.topPollen(data), { name: 'Birch', value: 120 })
  assert.strictEqual(Air.pollenLevel(120), 'high')
  assert.strictEqual(Air.aqiBand(55), 'moderate')
  assert.strictEqual(Air.uvBand(6.2), 'high')
})

// ---- Sun & moon

test('sun: Munich on 2 Nov 2026 matches published times within 5 minutes', () => {
  const data = Sun.compute(MUNICH, Date.UTC(2026, 10, 2, 11))
  // timeanddate.com: sunrise 07:03 CET, sunset 16:53 CET (06:03 / 15:53 UTC).
  assert.ok(Math.abs(data.sunrise - Date.UTC(2026, 10, 2, 6, 3)) < 5 * MIN, hhmm(data.sunrise))
  assert.ok(Math.abs(data.sunset - Date.UTC(2026, 10, 2, 15, 53)) < 5 * MIN, hhmm(data.sunset))
  assert.ok(data.goldenStart < data.sunset)
  assert.ok(data.daylightDeltaMs < 0, 'days are getting shorter in November')
  assert.strictEqual(Sun.formatDuration(data.daylightMs).split(' ')[0], '9h')
})

test('sun: polar night and midnight sun', () => {
  const tromso = { latitude: 69.65, longitude: 18.96 }
  assert.strictEqual(Sun.compute(tromso, Date.UTC(2026, 11, 21, 12)).polar, 'night')
  assert.strictEqual(Sun.compute(tromso, Date.UTC(2026, 5, 21, 12)).polar, 'day')
  assert.strictEqual(Sun.nextEvent(Sun.compute(tromso, Date.UTC(2026, 5, 21, 12)), Date.UTC(2026, 5, 21, 12)), null)
})

test('sun: next event and pill text', () => {
  const data = Sun.compute(MUNICH, Date.UTC(2026, 10, 2, 11))
  assert.strictEqual(Sun.nextEvent(data, Date.UTC(2026, 10, 2, 5)).kind, 'sunrise')
  assert.strictEqual(Sun.nextEvent(data, Date.UTC(2026, 10, 2, 11)).kind, 'sunset')
  assert.strictEqual(Sun.nextEvent(data, Date.UTC(2026, 10, 2, 20)), null)
  assert.match(Sun.compact(data, {}, Date.UTC(2026, 10, 2, 11), hhmm), /^󰖛 15:5\d$/)
  assert.strictEqual(Sun.formatDelta(-188000), '−3m 8s')
})

test('moon: known phases', () => {
  // Full moon 2026-10-26 04:12 UTC, new moon 2026-11-09 07:02 UTC. The
  // mean synodic month drifts up to about a day from the true phase.
  const full = Sun.moonPhase(Date.UTC(2026, 9, 26, 4, 12))
  assert.ok(Math.abs(full - 0.5) < 0.035, String(full))
  assert.ok(Sun.moonIllumination(full) > 0.99)
  assert.strictEqual(Sun.moonPhaseIndex(full), 4)
  const fresh = Sun.moonPhase(Date.UTC(2026, 10, 9, 7, 2))
  assert.ok(fresh < 0.035 || fresh > 0.965, String(fresh))
  assert.strictEqual(Sun.moonPhaseIndex(Sun.moonPhase(Date.UTC(2026, 10, 2, 12))), 6) // last quarter on 1 Nov
})

// ---- Tides

test('tides need a coast spot', () => {
  assert.deepStrictEqual(Tides.urls(MUNICH), [])
  assert.match(Tides.urls({ spot: { latitude: 43.48, longitude: -1.56 } })[0], /sea_level_height_msl/)
})

test('tides: turning points of the Biarritz model, about 6h12m apart', () => {
  const data = Tides.parse([fixture('tides-biarritz.json')])
  const turns = Tides.extremes(data.points)
  assert.deepStrictEqual(turns.slice(0, 4).map((t) => t.kind), ['low', 'high', 'low', 'high'])
  for (let i = 1; i < turns.length; i++) {
    const gap = (turns[i].at - turns[i - 1].at) / HOUR
    assert.ok(gap > 5 && gap < 7.5, `gap ${gap.toFixed(2)}h`)
  }
  // Refined between samples, so not on the hour.
  assert.notStrictEqual(turns[0].at % HOUR, 0)
})

test('tides: outlook, current height and pill', () => {
  const data = Tides.parse([fixture('tides-biarritz.json')])
  const turns = Tides.extremes(data.points)
  const now = turns[0].at + HOUR // just after the first low
  const view = Tides.outlook(data, now)
  assert.strictEqual(view.rising, true)
  assert.deepStrictEqual(view.next.map((t) => t.kind), ['high', 'low'])
  const height = Tides.heightAt(data, now)
  assert.ok(height > turns[0].height && height < turns[1].height)
  assert.strictEqual(Tides.compact(data, {}, now, hhmm), '󰁝 ' + hhmm(turns[1].at))
  assert.strictEqual(Tides.formatHeight(0.69, false), '0.7 m')
  assert.strictEqual(Tides.formatHeight(0.69, true), '2.3 ft')
})

test('tides: an inland spot says so instead of failing', () => {
  const inland = JSON.stringify({ hourly: { time: [1, 2], sea_level_height_msl: [null, null] } })
  assert.deepStrictEqual(Tides.parse([inland]), { points: [], inland: true })
  assert.strictEqual(Tides.parse(['']), null)
})

// ---- Swell

test('swell: marine and wind for Biarritz', () => {
  const data = Swell.parse([fixture('swell-biarritz.json'), fixture('wind-biarritz.json')])
  assert.strictEqual(data.swellHeight, 1)
  assert.strictEqual(data.swellPeriod, 10)
  assert.strictEqual(Swell.compass(data.swellDirection), 'NW') // 306°
  assert.strictEqual(Swell.formatSwell(data, false), '1.0 m · 10s')
  assert.strictEqual(Swell.formatWind(data, false), '10 km/h NNW')
  assert.strictEqual(Swell.formatSeaTemp(data.seaTemp, false), '17.4°C')
  assert.strictEqual(data.forecast.length, 72)
  assert.strictEqual(Swell.compact(data, {}), '󰞍 1.0m 10s')
})

test('swell: inland spot, failed marine fetch, missing wind', () => {
  assert.deepStrictEqual(Swell.parse([fixture('swell-munich.json'), '']), { inland: true })
  assert.strictEqual(Swell.parse(['', fixture('wind-biarritz.json')]), null)
  const noWind = Swell.parse([fixture('swell-biarritz.json'), ''])
  assert.strictEqual(Swell.formatWind(noWind, false), '-')
  assert.strictEqual(Swell.compact({ inland: true }, {}), '')
})

test('compass wraps around north', () => {
  assert.deepStrictEqual([0, 11, 12, 349, 360, -10].map(Swell.compass), ['N', 'N', 'NNE', 'N', 'N', 'N'])
})
