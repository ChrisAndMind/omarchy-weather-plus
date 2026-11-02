import QtQuick
import qs.Commons
import "River.js" as River

// Seven-day flow trend as a braille-dot plot. The header shows the week's
// range, or the hovered bucket's time and value; a day axis runs underneath.
// Fewer than two readings shows a "collecting" note instead of an empty plot.
Column {
  id: chart

  property var bar: null
  // [{at, value}] flow readings in m³/s, any order, any span.
  property var history: []
  property int rows: 3

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
    endMs = Date.now()
    startMs = endMs - River.CHART_WINDOW_MS
    buckets = River.bucketSeries(history, startMs, endMs, chars * 2)
    plot = River.brailleChart(buckets, rows)
    axis = River.dayAxis(startMs, endMs, axisChars, function(date) { return Qt.formatDate(date, "ddd").toUpperCase() })
  }

  function hoverLabel() {
    var value = buckets[hoverIndex]
    if (value === null || value === undefined) return "no reading"
    var at = new Date(startMs + (hoverIndex + 0.5) * (endMs - startMs) / buckets.length)
    return Qt.formatDateTime(at, "ddd HH:00").toUpperCase() + " · " + value.toFixed(1) + " m³/s"
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
      text: "FLOW · 7D"
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
      text: chart.hoverIndex >= 0 ? chart.hoverLabel() : River.formatFlowRange(chart.plot.min, chart.plot.max)
      color: Qt.darker(chart.bar.foreground, 1.5)
      font.family: chart.bar.fontFamily
      font.pixelSize: Style.font.caption
      font.letterSpacing: 1
    }
  }

  Text {
    visible: chart.readingCount < 2
    x: Style.space(16)
    text: "collecting readings…"
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
