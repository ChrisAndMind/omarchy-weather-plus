import QtQuick
import qs.Commons
import "Cache.js" as Cache

// One labelled value in a module row, styled like the hero's FEELS/WIND/HUMID
// stats. A stale value is dimmed and its age replaces the caption.
Column {
  id: stat

  property var bar: null
  property string label: ""
  property string value: ""
  property string caption: ""
  property bool stale: false
  property real ageMs: 0

  spacing: Style.space(5)

  Text {
    text: stat.label
    color: Qt.darker(stat.bar.foreground, 1.5)
    font.family: stat.bar.fontFamily
    font.pixelSize: Style.font.bodySmall
    font.letterSpacing: 1
  }
  Text {
    textFormat: Text.PlainText
    text: stat.value
    opacity: stat.stale ? 0.5 : 1
    color: stat.bar.foreground
    font.family: stat.bar.fontFamily
    font.pixelSize: Style.font.title
  }
  Text {
    visible: text !== ""
    textFormat: Text.PlainText
    text: stat.stale ? Cache.formatAge(stat.ageMs) : stat.caption
    color: Qt.darker(stat.bar.foreground, 1.5)
    font.family: stat.bar.fontFamily
    font.pixelSize: Style.font.caption
    font.italic: stat.stale
  }
}
