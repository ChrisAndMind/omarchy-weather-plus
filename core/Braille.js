// Time series drawn as a braille-dot plot, shared by every module chart. Each
// braille cell is 2 dot columns × 4 dot rows, so a chart `chars` wide and
// `rows` tall has chars*2 time buckets and rows*4 value levels.

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null
  var n = parseFloat(String(value))
  return isNaN(n) ? null : n
}

function timestampOrNull(value) {
  if (value === undefined || value === null || value === "") return null
  var ms = typeof value === "number" ? value : Date.parse(String(value))
  return isNaN(ms) ? null : ms
}

// Dot bit per [column][row] within a cell, row 0 at the top (Unicode
// braille numbering: dots 1-2-3-7 down the left, 4-5-6-8 down the right).
var BRAILLE_DOTS = [[0x01, 0x02, 0x04, 0x40], [0x08, 0x10, 0x20, 0x80]]

// [{at, value}] → `count` evenly spaced buckets over [startMs, endMs), each
// the mean of its points or null when it has none (drawn as a gap).
function bucketSeries(points, startMs, endMs, count) {
  var sums = []
  var counts = []
  for (var i = 0; i < count; i++) { sums.push(0); counts.push(0) }

  var span = endMs - startMs
  for (var j = 0; points && j < points.length; j++) {
    var at = timestampOrNull(points[j] && points[j].at)
    var value = numberOrNull(points[j] && points[j].value)
    if (at === null || value === null || at < startMs || at >= endMs) continue
    var index = Math.min(count - 1, Math.floor((at - startMs) / span * count))
    sums[index] += value
    counts[index]++
  }

  var out = []
  for (var k = 0; k < count; k++) out.push(counts[k] ? sums[k] / counts[k] : null)
  return out
}

// Bucket values → braille text lines, top line first. Consecutive buckets
// are joined by a vertical run of dots so the trace reads as a line; a null
// bucket breaks it. A flat series sits mid-height.
function brailleChart(values, rows) {
  var chars = Math.ceil(values.length / 2)
  var levels = rows * 4
  var grid = []
  for (var r = 0; r < rows; r++) {
    var line = []
    for (var c = 0; c < chars; c++) line.push(0)
    grid.push(line)
  }

  var min = Infinity
  var max = -Infinity
  for (var i = 0; i < values.length; i++) {
    if (values[i] === null) continue
    min = Math.min(min, values[i])
    max = Math.max(max, values[i])
  }

  function yFor(value) {
    if (max === min) return Math.floor(levels / 2)
    return levels - 1 - Math.round((value - min) / (max - min) * (levels - 1))
  }

  var prevY = null
  for (var x = 0; x < values.length; x++) {
    if (values[x] === null) { prevY = null; continue }
    var y = yFor(values[x])
    var from = prevY === null ? y : Math.min(prevY, y)
    var to = prevY === null ? y : Math.max(prevY, y)
    for (var dotY = from; dotY <= to; dotY++)
      grid[Math.floor(dotY / 4)][Math.floor(x / 2)] |= BRAILLE_DOTS[x % 2][dotY % 4]
    prevY = y
  }

  var lines = []
  for (var row = 0; row < rows; row++) {
    var text = ""
    for (var col = 0; col < chars; col++) text += String.fromCharCode(0x2800 + grid[row][col])
    lines.push(text)
  }
  return { lines: lines, min: min === Infinity ? null : min, max: max === -Infinity ? null : max }
}

// A `chars`-wide axis line with a day label (from labelFor(date)) at the
// column where each local day starts. The partial first day is labelled
// at column 0; a label without two spaces before the next one is dropped.
function dayAxis(startMs, endMs, chars, labelFor) {
  var starts = [{ index: 0, date: new Date(startMs) }]
  var day = new Date(startMs)
  day.setHours(24, 0, 0, 0)
  for (; day.getTime() < endMs; day.setDate(day.getDate() + 1))
    starts.push({ index: Math.floor((day.getTime() - startMs) / (endMs - startMs) * chars), date: new Date(day.getTime()) })

  var axis = []
  for (var i = 0; i < chars; i++) axis.push(" ")
  for (var j = 0; j < starts.length; j++) {
    var label = String(labelFor(starts[j].date))
    // Last column this label may use: two spaces short of the next label,
    // or the end of the axis.
    var limit = j + 1 < starts.length ? starts[j + 1].index - 3 : chars - 1
    if (starts[j].index + label.length - 1 > limit) continue
    for (var k = 0; k < label.length; k++) axis[starts[j].index + k] = label[k]
  }
  return axis.join("")
}

if (typeof module !== "undefined") {
  module.exports = {
    bucketSeries: bucketSeries,
    brailleChart: brailleChart,
    dayAxis: dayAxis
  }
}
