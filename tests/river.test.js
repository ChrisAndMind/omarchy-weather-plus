const test = require('node:test')
const assert = require('node:assert')
const River = require('../River.js')

const NOW = Date.UTC(2026, 9, 31, 12, 0)
const HOUR = 60 * 60 * 1000

test('fresh values are shown and cached', () => {
  const fresh = River.parseRiverResponse('{"waterTemperature": 14.2, "flow": "21.5"}')
  const { display, cache } = River.mergeRiverReading(fresh, {}, NOW)
  assert.deepStrictEqual(display.temperatureC, { value: 14.2, stale: false, ageMs: 0 })
  assert.deepStrictEqual(display.flowM3s, { value: 21.5, stale: false, ageMs: 0 })
  assert.deepStrictEqual(cache, { temperatureC: { value: 14.2, at: NOW }, flowM3s: { value: 21.5, at: NOW } })
})

test('measuredAt from the API is recorded instead of the fetch time', () => {
  const fresh = River.parseRiverResponse(JSON.stringify({ waterTemperature: 9, measuredAt: new Date(NOW - HOUR).toISOString() }))
  const { display, cache } = River.mergeRiverReading(fresh, {}, NOW)
  assert.strictEqual(cache.temperatureC.at, NOW - HOUR)
  assert.strictEqual(display.temperatureC.ageMs, HOUR)
})

test('null within 24h falls back to the cached value as stale', () => {
  const cache = { temperatureC: { value: 13.8, at: NOW - 3 * HOUR } }
  const fresh = River.parseRiverResponse('{"waterTemperature": null, "flow": null}')
  const { display } = River.mergeRiverReading(fresh, cache, NOW)
  assert.deepStrictEqual(display.temperatureC, { value: 13.8, stale: true, ageMs: 3 * HOUR })
  assert.strictEqual(River.formatAge(display.temperatureC.ageMs), '3h ago')
})

test('null after 24h shows "-"', () => {
  const cache = { temperatureC: { value: 13.8, at: NOW - 25 * HOUR } }
  const { display } = River.mergeRiverReading(River.parseRiverResponse('{}'), cache, NOW)
  assert.strictEqual(display.temperatureC, null)
  assert.strictEqual(River.formatRiverTemp(display.temperatureC, false), '-')
})

test('fields are resolved independently', () => {
  const cache = { temperatureC: { value: 12, at: NOW - HOUR }, flowM3s: { value: 20, at: NOW - HOUR } }
  const fresh = River.parseRiverResponse('{"waterTemperature": null, "flow": 22.4}')
  const { display, cache: next } = River.mergeRiverReading(fresh, cache, NOW)
  assert.strictEqual(display.temperatureC.stale, true)
  assert.strictEqual(display.flowM3s.stale, false)
  assert.deepStrictEqual(next.temperatureC, cache.temperatureC)
  assert.deepStrictEqual(next.flowM3s, { value: 22.4, at: NOW })
})

test('empty or garbled responses fall back to the cache', () => {
  const cache = { flowM3s: { value: 19.1, at: NOW - 30 * 60 * 1000 } }
  for (const raw of ['', 'not json', '<html>502</html>', 'null']) {
    const { display } = River.mergeRiverReading(River.parseRiverResponse(raw), cache, NOW)
    assert.strictEqual(display.temperatureC, null, raw)
    assert.deepStrictEqual(display.flowM3s, { value: 19.1, stale: true, ageMs: 30 * 60 * 1000 }, raw)
  }
})

test('cache file parsing drops malformed entries', () => {
  assert.deepStrictEqual(River.parseCacheFile(''), {})
  assert.deepStrictEqual(River.parseCacheFile('{"temperatureC": {"value": "x", "at": 1}, "flowM3s": {"value": 3, "at": 5}}'),
    { flowM3s: { value: 3, at: 5 } })
})

test('formatting', () => {
  assert.strictEqual(River.formatRiverTemp({ value: 14.24 }, false), '14.2°C')
  assert.strictEqual(River.formatRiverTemp({ value: 15 }, true), '59.0°F')
  assert.strictEqual(River.formatRiverFlow({ value: 21.46 }), '21.5 m³/s')
  assert.strictEqual(River.formatRiverFlow(null), '-')
  assert.strictEqual(River.formatAge(20 * 1000), 'just now')
  assert.strictEqual(River.formatAge(45 * 60 * 1000), '45m ago')
})

test('bucketSeries averages points per bucket and leaves gaps null', () => {
  const start = NOW - 4 * HOUR
  const points = [
    { at: start + 0.2 * HOUR, value: 10 },
    { at: start + 0.8 * HOUR, value: 12 },
    { at: start + 3.5 * HOUR, value: 20 },
    { at: start - HOUR, value: 99 },  // before the window
    { at: start + 2.5 * HOUR, value: null }
  ]
  assert.deepStrictEqual(River.bucketSeries(points, start, NOW, 4), [11, null, null, 20])
})

test('brailleChart draws a rising trace bottom-left to top-right', () => {
  const { lines, min, max } = River.brailleChart([0, 1, 2, 3, 4, 5, 6, 7], 2)
  assert.strictEqual(min, 0)
  assert.strictEqual(max, 7)
  assert.strictEqual(lines.length, 2)
  assert.strictEqual(lines[0].length, 4)
  // Bottom-left dot (dot 7) set first; top-right dot (dot 4) set last.
  assert.strictEqual(lines[1].charCodeAt(0) & 0x40, 0x40)
  assert.strictEqual(lines[0].charCodeAt(3) & 0x08, 0x08)
  assert.strictEqual(lines[0][0], '⠀')
})

test('brailleChart breaks the line at gaps and handles empty input', () => {
  const { lines } = River.brailleChart([5, null, null, 5], 1)
  assert.strictEqual(lines[0].length, 2)
  assert.notStrictEqual(lines[0][0], '⠀')
  assert.notStrictEqual(lines[0][1], '⠀')
  const empty = River.brailleChart([null, null], 1)
  assert.deepStrictEqual([empty.min, empty.max, empty.lines], [null, null, ['⠀']])
})

test('dayAxis labels local midnights and drops colliding labels', () => {
  const start = new Date(2026, 9, 24, 12, 0).getTime()  // Saturday noon, local
  const end = start + 7 * 24 * HOUR
  const label = (d) => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d.getDay()]
  const axis = River.dayAxis(start, end, 28, label)
  assert.strictEqual(axis.length, 28)
  // Saturday half-day gets 2 columns, too narrow for its label; Sunday starts at column 2.
  assert.strictEqual(axis.slice(0, 6), '  SU  ')
  assert.strictEqual(axis.trim().split(/\s+/).join(' '), 'SU MO TU WE TH FR SA')
})

test('formatFlowRange', () => {
  assert.strictEqual(River.formatFlowRange(18.24, 24.06), '18.2–24.1 m³/s')
  assert.strictEqual(River.formatFlowRange(null, null), '')
})
