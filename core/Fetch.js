// One curl run per module refresh, however many URLs the module needs.
// curl fetches the URLs in order and prints MARKER after each transfer, so
// the output splits back into one body per URL. --fail leaves the body of
// an HTTP error empty, and a transfer that never connected still gets its
// marker (status 000), so the bodies always line up with the URLs.

var MARKER_PREFIX = "\n@@weather-plus:"
var MARKER_SUFFIX = "@@\n"

function curlCommand(urls, timeoutSec) {
  var command = ["curl", "-sS", "--fail", "--max-time", String(timeoutSec || 10),
    "-w", MARKER_PREFIX + "%{http_code}" + MARKER_SUFFIX]
  for (var i = 0; i < urls.length; i++) command.push(urls[i])
  return command
}

// curl output → [body, …], one per URL; a non-2xx transfer yields "".
// Missing trailing transfers (curl killed mid-run) yield "" too.
function splitResponses(output, count) {
  var bodies = []
  var rest = String(output || "")
  var pattern = /\n@@weather-plus:(\d{3})@@\n/
  for (var i = 0; i < count; i++) {
    var match = pattern.exec(rest)
    if (!match) {
      bodies.push("")
      continue
    }
    var ok = match[1].charAt(0) === "2"
    bodies.push(ok ? rest.slice(0, match.index) : "")
    rest = rest.slice(match.index + match[0].length)
  }
  return bodies
}

if (typeof module !== "undefined") {
  module.exports = {
    curlCommand: curlCommand,
    splitResponses: splitResponses
  }
}
