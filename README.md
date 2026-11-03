# Weather+ for Omarchy

**The stock Omarchy weather widget, plus optional extras you switch on.**
Out of the box it looks and behaves exactly like the built-in weather pill.
Open the popup and click **Modules** to add rows under the forecast:

| Module | What it shows | Data (all free, no API key) |
|---|---|---|
| Weather warnings | Official DWD warnings with severity and validity; click one for details | [Bright Sky](https://brightsky.dev) (Germany only) |
| Rain radar | Rain in the next 2 hours, in 15-minute blocks: "Rain in 25 min", "stops in ~45 min" | [Open-Meteo](https://open-meteo.com) |
| Air & pollen | European air quality index, UV index, strongest pollen | Open-Meteo air quality (pollen: Europe only) |
| Sun & moon | Sunrise, golden hour, sunset, daylight gained vs yesterday, moon phase | Computed locally, works offline |
| Tides | Sea level now, next high and low water, 48h curve | Open-Meteo marine |
| Swell | Swell height, period and direction, sea temperature, wind, 48h swell trend | Open-Meteo marine + forecast |
| Eisbach | Water temperature and flow of Munich's Eisbach, 7-day flow trend | [eisbach.chrisvb.dev](https://eisbach.chrisvb.dev) |

Any enabled module can also put a short reading next to the bar icon:
the next tide (`↓ 16:08`), a rain countdown (`󰖗 25'`), active warnings
(`󰀦 2`), swell (`󰞍 1.0m 10s`), AQI, the next sunrise/sunset or the Eisbach
temperature. Pick it under **Modules › In the bar**.

## Install

```bash
omarchy plugin add https://github.com/ChrisAndMind/omarchy-weather-plus.git --enable
```

It lands in the bar next to your current weather widget. To replace the
built-in one, remove that from the bar (Setup › Bar, or
`omarchy plugin disable omarchy.weather`) and move this one into its place
with `omarchy bar move chrisvb.weather-plus`.

## Settings

Everything lives on the widget's entry in `~/.config/omarchy/shell.json`,
editable from the popup (**Modules**), from Setup, or by hand:

| Key | Default | |
|---|---|---|
| `showAlerts`, `showRain`, `showAir`, `showSun`, `showTides`, `showSwell`, `showEisbach` | `false` | Turn a module on |
| `spotName`, `spotLatitude`, `spotLongitude` | empty | Coast spot for tides and swell. Empty uses the weather location |
| `pillModule` | `"none"` | Module shown next to the bar icon |
| `unit` | `"auto"` | `metric`, `imperial`, or `auto` (locale and country) |
| `refreshMinutes` | `15` | Weather refresh interval. Modules have their own (10 min – 3 h) |

The weather location is shared with the stock widget
(`omarchy-weather-location`, or click the place name in the popup).

## Where the data comes from

The forecast and current conditions come from [Open-Meteo](https://open-meteo.com),
which serves the national weather models (DWD ICON for Germany, ECMWF
elsewhere). Unlike the stock widget, Weather+ doesn't use wttr.in.

With no location set, Weather+ finds one by itself:

1. **IP lookup:** one HTTPS request to [ipinfo.io](https://ipinfo.io)
   (no key) for the city of your IP address, repeated every 6 hours so a
   laptop picks up its new city.
2. **Timezone:** if that fails, it uses the main city of your system
   timezone (`/etc/localtime` and tzdata's `zone1970.tab`). This works
   offline but is coarse: Munich shows as Berlin.

The result is kept in `~/.local/state/omarchy/weather-plus-location.json`,
so a restart or an offline start still knows where it is. Set a location
in the popup to skip detection entirely; then nothing about your IP leaves
the machine beyond the Open-Meteo requests themselves.

```bash
omarchy bar set chrisvb.weather-plus showTides true --json
omarchy bar set chrisvb.weather-plus pillModule tides
omarchy-shell chrisvb.weather-plus settings   # open the popup on Modules
```

## Good to know

- **Tides are modelled, not a harbour table.** Open-Meteo's sea level
  includes the tide, and the plugin finds the turning points in it. Expect
  times within roughly 15–30 minutes of an official table. That's fine for
  planning a surf, not for navigation.
- **Inland coast spots.** If the spot is too far inland for the marine
  model, tides and swell say "No sea at this spot". Pick a beach instead.
- **Offline.** Each module keeps its last good reading in
  `~/.local/state/omarchy/weather-plus-<module>.json` and shows it dimmed,
  with its age, for up to 24 hours.
- **Lightweight.** A module only fetches while it's enabled, with one
  `curl` per refresh no matter how many URLs it needs. Disabled modules
  cost nothing.

## Writing a module

A module is a folder in `modules/<id>/` with two files, plus a line in
`modules/Registry.js` and in the `moduleSources` map in `Panel.qml`:

- `Source.js`: plain JavaScript, no QML, so it runs under `node --test`.
  It exports `urls(ctx)`, `parse(texts, ctx)` (or `compute(ctx, nowMs)`
  for local-only data) and `compact(data, ctx, nowMs, formatTime)` for the
  bar. See the contract at the top of `modules/Registry.js`.
- `Row.qml`: the popup row. It receives `bar`, `entry`
  (`{ value, stale, ageMs }`), `status`, `ctx` and `now`. Build it from
  `core/StatsLine.qml`, `core/Stat.qml` and `core/BrailleChart.qml` so it
  matches the rest.

Then add a `show<Id>` boolean to `manifest.json`, with tests and a real API
response in `tests/fixtures/`.

## Development

```bash
node --test tests/
omarchy plugin validate .
```

See [UPDATING.md](UPDATING.md) for the dev loop and for merging upstream
changes to Omarchy's weather widget.

## License

MIT. The core weather popup is derived from Omarchy's built-in weather
plugin.
