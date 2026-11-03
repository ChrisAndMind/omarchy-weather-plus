const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const Locate = require('../core/Locate.js')

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
const zoneTab = fixture('zone1970-excerpt.tab')

test('ipinfo gives the city, coordinates and country', () => {
  assert.deepStrictEqual(Locate.parseIpinfo(fixture('ipinfo-munich.json')), {
    name: 'Munich', latitude: 48.1374, longitude: 11.5755, country: 'DE', source: 'ip'
  })
})

test('ipinfo without a usable loc is ignored', () => {
  assert.strictEqual(Locate.parseIpinfo('{"ip":"203.0.113.7","bogon":true}'), null)
  assert.strictEqual(Locate.parseIpinfo('{"loc":"91,10"}'), null)
  assert.strictEqual(Locate.parseIpinfo('<html>rate limited</html>'), null)
  assert.strictEqual(Locate.parseIpinfo(''), null)
})

test('ISO 6709 with and without seconds', () => {
  assert.deepStrictEqual(Locate.parseIso6709('+5230+01322'), { latitude: 52.5, longitude: 13 + 22 / 60 })
  const ny = Locate.parseIso6709('+404251-0740023')
  assert.ok(Math.abs(ny.latitude - 40.7142) < 1e-3 && Math.abs(ny.longitude + 74.0064) < 1e-3)
  assert.strictEqual(Locate.parseIso6709('5230+01322'), null)
})

test('the localtime symlink names the zone', () => {
  assert.strictEqual(Locate.zoneFromLocaltime('/usr/share/zoneinfo/Europe/Berlin\n'), 'Europe/Berlin')
  assert.strictEqual(Locate.zoneFromLocaltime('../usr/share/zoneinfo/posix/America/New_York'), 'America/New_York')
  assert.strictEqual(Locate.zoneFromLocaltime('/etc/localtime'), '')
})

test('the timezone gives its principal city', () => {
  const berlin = Locate.timezoneLocation('Europe/Berlin', zoneTab)
  assert.strictEqual(berlin.name, 'Berlin')
  assert.strictEqual(berlin.country, 'DE')
  assert.strictEqual(berlin.source, 'timezone')
  assert.ok(Math.abs(berlin.latitude - 52.5) < 0.01)
  assert.strictEqual(Locate.timezoneLocation('America/Argentina/Buenos_Aires', zoneTab).name, 'Buenos Aires')
  assert.ok(Locate.timezoneLocation('Australia/Sydney', zoneTab).latitude < 0)
  assert.strictEqual(Locate.timezoneLocation('Etc/UTC', zoneTab), null)
  assert.strictEqual(Locate.timezoneLocation('', zoneTab), null)
})

test('an IP lookup beats the timezone guess, never the other way round', () => {
  const ip = Locate.parseIpinfo(fixture('ipinfo-munich.json'))
  const tz = Locate.timezoneLocation('Europe/Berlin', zoneTab)
  assert.strictEqual(Locate.preferred(null, tz), tz)
  assert.strictEqual(Locate.preferred(tz, ip), ip)
  assert.strictEqual(Locate.preferred(ip, tz), ip)
  assert.strictEqual(Locate.preferred(ip, null), ip)
})

test('the stored detection round-trips and rejects junk', () => {
  const stored = Locate.parseStored(JSON.stringify({ name: 'Munich', latitude: 48.1, longitude: 11.6, country: 'DE', source: 'ip', at: 5 }))
  assert.deepStrictEqual(stored, { name: 'Munich', latitude: 48.1, longitude: 11.6, country: 'DE', source: 'ip', at: 5 })
  // The file written by the previous version had only coordinates.
  assert.strictEqual(Locate.parseStored('{"latitude":48.137,"longitude":11.575}').at, 0)
  assert.strictEqual(Locate.parseStored('{"latitude":"x"}'), null)
  assert.strictEqual(Locate.parseStored('not json'), null)
})
