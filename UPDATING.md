# chris.weather

A clone of Omarchy's built-in `omarchy.weather` widget, with Eisbach water
temperature and flow added to the popup.

- `River.js`: parsing, the 24h cache fallback, and formatting. `parseRiverResponse` is the only API-specific code.
- `RiverRow.qml`: the EISBACH row in the popup.
- `RiverChart.qml`: the 7-day flow trend, drawn with braille dots (bucketing and rendering live in `River.js`).
- `Panel.qml`: the stock panel plus a few additions, each marked `// river:`.
- `Model.js`, `BarWidget.qml`: unchanged from upstream.
- The cache lives in `~/.local/state/omarchy/river.json`.

Tests: `node --test tests/`

After editing, run `omarchy restart shell`. The shell's hot reload doesn't
reliably pick up changes to this plugin.

## Bringing in an Omarchy update to the stock weather widget

The `upstream` branch holds the untouched stock files; `main` has our changes on top.

```bash
cd ~/.config/omarchy/plugins/chris.weather
diff -rq /usr/share/omarchy/shell/plugins/panels/weather . -x manifest.json -x .git   # anything new upstream?

git checkout upstream
cp /usr/share/omarchy/shell/plugins/panels/weather/{BarWidget.qml,Model.js,Panel.qml} .   # plus any new files
git commit -am "Omarchy $(omarchy version) weather widget"
git checkout main
git merge upstream          # conflicts can only be in Panel.qml, around the `// river:` lines
node --test tests/ && omarchy restart shell
```

Keep this clone's `manifest.json`: it carries the `chris.weather` id.
