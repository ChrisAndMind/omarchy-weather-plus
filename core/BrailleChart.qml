import QtQuick
import qs.Commons
import "Braille.js" as Braille

// A time series as a braille-dot plot over a window relative to now (the
// past week for Eisbach flow, the next two days for swell). The header
// shows the window's range, or the hovered bucket's time and value; a day
// axis runs underneath. Fewer than two readings shows `emptyText` instead
// of an empty plot.
Column {
  id: chart

  property var bar: null
  // [{at, value}] readings, any order, any span.
  property var history: []
  property int rows: 3
  property string title: ""
  property string emptyText: "collecting readings…"
  // Window edges relative to now.
  property real fromMs: -7 * 24 * 60 * 60 * 1000
  property real toMs: 0
  property var formatValue: function(value) { return value.toFixed(1) }
  property var formatRange: function(min, max) {
    return min === null ? "" : chart.formatValue(min) + " – " + chart.formatValue(max)
  }

  property var buckets: []
  property var plot: ({ lines: [], min: null, max: null })
  property string axis: ""
  property real startMs: 0
  property real endMs: 0
  property int hoverIndex: -1

  readonly property real plotWidth: width - Style.space(36)
  readonly property int chars: Math.max(8, Math.floor(plotWidth / cell.advanceWidth))
  // The axis uses the smaller caption font, so it has its own column count
  // spanning the same width as the plot.
  readonly property int axisChars: Math.max(8, Math.floor(chars * cell.advanceWidth / axisCell.advanceWidth))
  readonly property int readingCount: buckets.filter(function(v) { return v !== null }).length

  spacing: Style.space(4)

  function rebuild() {
    var now = Date.now()
    startMs = now + fromMs
    endMs = now + toMs
    buckets = Braille.bucketSeries(history, startMs, endMs, chars * 2)
    plot = Braille.brailleChart(buckets, rows)
    axis = Braille.dayAxis(startMs, endMs, axisChars, function(date) { return Qt.formatDate(date, "ddd").toUpperCase() })
  }

  function hoverLabel() {
    var value = buckets[hoverIndex]
    if (value === null || value === undefined) return "no reading"
    var at = new Date(startMs + (hoverIndex + 0.5) * (endMs - startMs) / buckets.length)
    return Qt.formatDateTime(at, "ddd HH:00").toUpperCase() + " · " + chart.formatValue(value)
  }

  onHistoryChanged: rebuild()
  onCharsChanged: rebuild()
  onAxisCharsChanged: rebuild()
  onVisibleChanged: if (visible) rebuild()
  Component.onCompleted: rebuild()

  TextMetrics {
    id: cell
    font: plotText.font
    text: "⣿"
  }

  TextMetrics {
    id: axisCell
    font: axisText.font
    text: "M"
  }

  Item {
    width: parent.width
    height: header.implicitHeight

    Text {
      id: header
      anchors.left: parent.left
      anchors.leftMargin: Style.space(16)
      text: chart.title
      color: Qt.darker(chart.bar.foreground, 1.5)
      font.family: chart.bar.fontFamily
      font.pixelSize: Style.font.bodySmall
      font.letterSpacing: 1
    }
    Text {
      anchors.right: parent.right
      anchors.rightMargin: Style.space(20)
      anchors.baseline: header.baseline
      textFormat: Text.PlainText
      text: chart.hoverIndex >= 0 ? chart.hoverLabel() : chart.formatRange(chart.plot.min, chart.plot.max)
      color: Qt.darker(chart.bar.foreground, 1.5)
      font.family: chart.bar.fontFamily
      font.pixelSize: Style.font.caption
      font.letterSpacing: 1
    }
  }

  Text {
    visible: chart.readingCount < 2
    x: Style.space(16)
    text: chart.emptyText
    color: Qt.darker(chart.bar.foreground, 1.5)
    font.family: chart.bar.fontFamily
    font.pixelSize: Style.font.bodySmall
    font.italic: true
  }

  Text {
    id: plotText
    visible: chart.readingCount >= 2
    x: Style.space(16)
    textFormat: Text.PlainText
    text: chart.plot.lines.join("\n")
    color: chart.bar.foreground
    font.family: chart.bar.fontFamily
    font.pixelSize: Style.font.body
    lineHeightMode: Text.ProportionalHeight
    lineHeight: 0.9

    MouseArea {
      anchors.fill: parent
      hoverEnabled: true
      onPositionChanged: function(mouse) {
        chart.hoverIndex = Math.max(0, Math.min(chart.buckets.length - 1, Math.floor(mouse.x / width * chart.buckets.length)))
      }
      onExited: chart.hoverIndex = -1
    }
  }

  Text {
    id: axisText
    visible: plotText.visible
    x: Style.space(16)
    textFormat: Text.PlainText
    text: chart.axis
    color: Qt.darker(chart.bar.foreground, 1.5)
    font.family: chart.bar.fontFamily
    font.pixelSize: Style.font.caption
    font.letterSpacing: 0
  }
}
