# Developing Weather+

- `Model.js`: Omarchy's stock weather model, untouched.
- `BarWidget.qml`, `Panel.qml`: the stock widget, with every addition marked `// plus:`.
- `SettingsView.qml`: the Modules page in the popup.
- `core/`: shared by every module. `Fetcher.qml` does fetching, caching and refreshing; `Fetch.js` runs one curl call per refresh; `Cache.js` keeps the last good value; `Braille.js` and `BrailleChart.qml` draw the charts; `Stat.qml` and `StatsLine.qml` lay out the rows.
- `modules/<id>/Source.js` + `Row.qml`: one folder per module. `modules/Registry.js` lists them, and the contract is documented at its top.
- Caches: `~/.local/state/omarchy/weather-plus-<id>.json`, keyed by the URLs they came from.

Tests: `node --test tests/`. Validate: `omarchy plugin validate .`

## Dev loop

The repo is symlinked into the shell's plugin folder:

```bash
ln -s ~/Work/omarchy-weather-plus ~/.config/omarchy/plugins/chrisvb.weather-plus
omarchy-shell shell rescanPlugins && omarchy plugin enable chrisvb.weather-plus
```

The shell's hot reload doesn't follow the symlink, so after editing run
`omarchy restart shell`. QML warnings land in the newest
`/run/user/$UID/quickshell/by-id/*/log.log`.

## Bringing in an Omarchy update to the stock weather widget

The `upstream` branch holds the untouched stock files; `main` has our changes on top.

```bash
cd ~/Work/omarchy-weather-plus
diff -q /usr/share/omarchy/shell/plugins/panels/weather/Model.js Model.js   # anything new upstream?
diff -q /usr/share/omarchy/shell/plugins/panels/weather/Panel.qml <(git show upstream:Panel.qml)

git checkout upstream
cp /usr/share/omarchy/shell/plugins/panels/weather/{BarWidget.qml,Model.js,Panel.qml} .   # plus any new files
git commit -am "Omarchy $(omarchy version) weather widget"
git checkout main
git merge upstream          # conflicts can only be in Panel.qml/BarWidget.qml, around the `// plus:` lines
node --test tests/ && omarchy restart shell
```

Keep this repo's `manifest.json`: it carries the `chrisvb.weather-plus` id,
which also has to match `moduleName`/`ipcTarget` in `BarWidget.qml` and
`Panel.qml`. The shell only lets a plugin write settings to its own id.
