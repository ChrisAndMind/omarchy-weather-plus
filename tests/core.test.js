const test = require('node:test')
const assert = require('node:assert')
const Cache = require('../core/Cache.js')
const Fetch = require('../core/Fetch.js')
const Registry = require('../modules/Registry.js')
const Eisbach = require('../modules/eisbach/Source.js')

const NOW = Date.UTC(2026, 10, 2, 12, 0)
const HOUR = 60 * 60 * 1000

test('fresh data is shown and cached', () => {
  const { display, cache } = Cache.merge({ aqi: 20 }, null, NOW)
  assert.deepStrictEqual(display, { value: { aqi: 20 }, stale: false, ageMs: 0 })
  assert.deepStrictEqual(cache, { value: { aqi: 20 }, at: NOW })
})

test('a failed fetch shows the cache as stale for 24h, then nothing', () => {
  const cache = { value: { aqi: 20 }, at: NOW - 2 * HOUR }
  assert.deepStrictEqual(Cache.merge(null, cache, NOW).display, { value: { aqi: 20 }, stale: true, ageMs: 2 * HOUR })
  assert.strictEqual(Cache.merge(null, cache, NOW + 23 * HOUR).display, null)
  assert.strictEqual(Cache.merge(null, cache, NOW + 23 * HOUR).cache, cache)
  assert.deepStrictEqual(Cache.merge(null, null, NOW), { display: null, cache: null })
})

test('cache files without a value or time are ignored', () => {
  assert.deepStrictEqual(Cache.parseCache('{"value": {"a": 1}, "at": 5}'), { value: { a: 1 }, at: 5 })
  for (const raw of ['', 'nope', '{"value": null, "at": 5}', '{"value": 1}', '{"value": 1, "at": "x"}'])
    assert.strictEqual(Cache.parseCache(raw), null, raw)
})

test('curl output splits into one body per URL, empty for failures', () => {
  const mark = (code) => `\n@@weather-plus:${code}@@\n`
  const out = '{"a":1}' + mark(200) + mark(404) + mark('000') + '{"b":2}' + mark(200)
  assert.deepStrictEqual(Fetch.splitResponses(out, 4), ['{"a":1}', '', '', '{"b":2}'])
  // curl killed before the last transfers
  assert.deepStrictEqual(Fetch.splitResponses('{"a":1}' + mark(200), 3), ['{"a":1}', '', ''])
  assert.deepStrictEqual(Fetch.splitResponses('', 1), [''])
})

test('curlCommand puts the marker after every transfer', () => {
  const command = Fetch.curlCommand(['https://a', 'https://b'], 7)
  assert.deepStrictEqual(command.slice(0, 5), ['curl', '-sS', '--fail', '--max-time', '7'])
  assert.deepStrictEqual(command.slice(-2), ['https://a', 'https://b'])
  assert.ok(command.includes('\n@@weather-plus:%{http_code}@@\n'))
})

test('every module is off by default and toggles by its show key', () => {
  assert.deepStrictEqual(Registry.enabledIds({}), [])
  assert.deepStrictEqual(Registry.enabledIds({ showTides: true, showRain: 'true', showAir: false }), ['rain', 'tides'])
  assert.strictEqual(Registry.settingKey('eisbach'), 'showEisbach')
  assert.strictEqual(Registry.usesSpot({ showRain: true }), false)
  assert.strictEqual(Registry.usesSpot({ showSwell: true }), true)
})

test('every registered module has a source with the contract', () => {
  for (const mod of Registry.MODULES) {
    const source = require(`../modules/${mod.id}/Source.js`)
    assert.strictEqual(typeof source.urls, 'function', mod.id)
    assert.ok(typeof source.parse === 'function' || typeof source.compute === 'function', mod.id)
    assert.strictEqual(typeof source.compact, 'function', mod.id)
  }
})

test('the pill only shows an enabled module', () => {
  assert.strictEqual(Registry.pillModule({ pillModule: 'rain', showRain: true }), 'rain')
  assert.strictEqual(Registry.pillModule({ pillModule: 'rain' }), '')
  assert.strictEqual(Registry.pillModule({ pillModule: 'none', showRain: true }), '')
  assert.strictEqual(Registry.pillModule({ pillModule: 'bogus', showBogus: true }), '')
})

test('Eisbach keeps its per-gauge cache and last good history across failures', () => {
  const current = JSON.stringify({ current: { observed_at: new Date(NOW).toISOString(), metrics: {
    wassertemperatur: { value: 9.5, ts: new Date(NOW).toISOString() }, abfluss: { value: 20.1, ts: new Date(NOW).toISOString() } } } })
  const history = JSON.stringify({ points: [{ ts: new Date(NOW - HOUR).toISOString(), value: 19 }] })

  const first = Eisbach.merge(Eisbach.parse([current, history]), null, NOW)
  assert.strictEqual(first.display.value.temperatureC.value, 9.5)
  assert.deepStrictEqual(first.display.value.history, [{ at: NOW - HOUR, value: 19 }])

  const restored = Eisbach.parseCache(JSON.stringify(first.cache))
  assert.deepStrictEqual(restored, first.cache)

  const offline = Eisbach.merge(Eisbach.parse(['', '']), restored, NOW + HOUR)
  assert.deepStrictEqual(offline.display.value.temperatureC, { value: 9.5, stale: true, ageMs: HOUR })
  assert.deepStrictEqual(offline.display.value.history, [{ at: NOW - HOUR, value: 19 }])
  assert.strictEqual(Eisbach.compact(offline.display.value, { imperial: false }), '󰖌 9.5°C')
})
