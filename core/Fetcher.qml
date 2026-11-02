import QtQuick
import Quickshell
import Quickshell.Io
import "Cache.js" as Cache
import "Fetch.js" as Fetch

// Keeps one module's data fresh while it's enabled: fetches the module's
// URLs in one curl run every `refreshMinutes`, parses them with the
// module's Source.js, and falls back to the last good value (persisted
// at cachePath) when a fetch fails. Local-only modules (compute()) skip
// the network and are recomputed on the same timer.
//
// `entry` is what rows and the pill read: { value, stale, ageMs } or null.
// `status` tells a row why there's no entry: "idle" (off or not configured),
// "loading", or "failed" (no fresh data and nothing cached).
Item {
  id: fetcher

  property string moduleId: ""
  property var source: null
  property var ctx: ({})
  property bool active: false
  property int refreshMinutes: 15
  property string cachePath: ""

  property var entry: null
  property string status: "idle"

  readonly property bool localOnly: !!source && typeof source.compute === "function"
  readonly property var urls: active && source && !localOnly ? source.urls(ctx) : []
  readonly property string urlsKey: urls.join("\n")

  property var cache: null
  property bool fetched: false
  // The cache file as read: { key, cache }, where key is the urlsKey it was
  // fetched with. It only counts while the module still asks for the same
  // URLs, so moving the location never shows the old place's data.
  property var stored: null
  // A refresh asked for while curl is still running; run it right after.
  property bool pending: false
  // The URLs the running curl was started with. Settings can change while
  // it runs; its output only counts for the URLs it actually fetched.
  property var runningUrls: []

  function parseCache(raw) {
    return source && typeof source.parseCache === "function" ? source.parseCache(raw) : Cache.parseCache(raw)
  }

  function merge(fresh) {
    var merged = source && typeof source.merge === "function"
      ? source.merge(fresh, cache, Date.now())
      : Cache.merge(fresh, cache, Date.now())
    entry = merged.display
    status = fresh !== null && fresh !== undefined ? "ok" : (merged.display ? "stale" : "failed")
    if (merged.cache === null || JSON.stringify(merged.cache) === JSON.stringify(cache)) return
    cache = merged.cache
    stored = { key: urlsKey, cache: merged.cache }
    cacheFile.setText(JSON.stringify(stored) + "\n")
  }

  // Show the stored value at startup, once the URLs it belongs to are known.
  // After a fetch has landed this is a no-op, so a reload of our own write
  // can't mark fresh values stale.
  function adoptStored() {
    if (fetched || !active || localOnly || !stored || stored.key !== urlsKey || urlsKey === "") return
    cache = parseCache(JSON.stringify(stored.cache))
    merge(null)
    // The fetch that follows decides between fresh, stale and failed.
    status = "loading"
  }

  function refresh() {
    if (!active || !source) return
    if (localOnly) {
      var value = source.compute(ctx, Date.now())
      entry = value === null ? null : { value: value, stale: false, ageMs: 0 }
      status = value === null ? "idle" : "ok"
      return
    }
    if (urls.length === 0) {
      entry = null
      status = "idle"
      return
    }
    if (entry === null) status = "loading"
    if (proc.running) {
      pending = true
      return
    }
    runningUrls = urls
    proc.command = Fetch.curlCommand(urls, 10)
    proc.running = true
  }

  // A changed location or spot makes the cached value belong somewhere
  // else: drop it from view and fetch again.
  onUrlsKeyChanged: {
    if (fetched) {
      entry = null
      cache = null
      fetched = false
    }
    adoptStored()
    Qt.callLater(refresh)
  }
  onCtxChanged: if (localOnly) Qt.callLater(refresh)
  onActiveChanged: {
    if (active) {
      Qt.callLater(refresh)
    } else {
      entry = null
      status = "idle"
    }
  }

  FileView {
    id: cacheFile
    path: fetcher.cachePath
    atomicWrites: true
    printErrors: false
    onLoaded: {
      try {
        var data = JSON.parse(text())
        fetcher.stored = data && typeof data.key === "string" ? data : null
      } catch (e) {
        fetcher.stored = null
      }
      fetcher.adoptStored()
    }
  }

  Process {
    id: proc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        if (fetcher.runningUrls.join("\n") !== fetcher.urlsKey) {
          fetcher.pending = true
          return
        }
        var bodies = Fetch.splitResponses(text, fetcher.runningUrls.length)
        var fresh = null
        try {
          fresh = fetcher.source.parse(bodies, fetcher.ctx)
        } catch (e) {
          fresh = null
        }
        fetcher.fetched = true
        fetcher.merge(fresh)
      }
    }
    onExited: {
      if (!fetcher.pending) return
      fetcher.pending = false
      Qt.callLater(fetcher.refresh)
    }
  }

  Timer {
    interval: Math.max(1, fetcher.refreshMinutes) * 60 * 1000
    running: fetcher.active
    repeat: true
    onTriggered: fetcher.refresh()
  }
}
