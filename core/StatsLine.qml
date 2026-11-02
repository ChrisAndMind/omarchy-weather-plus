import QtQuick
import qs.Commons
import "Cache.js" as Cache

// A module row's main line: the module name on the left (with an optional
// subtitle, or the data's age when it's stale) and its stats on the right.
// `message` replaces the stats when there's nothing to show yet.
Item {
  id: line

  property var bar: null
  property string title: ""
  property string subtitle: ""
  property string message: ""
  property bool stale: false
  property real ageMs: 0
  default property alias stats: statsRow.data

  width: parent ? parent.width : implicitWidth
  height: Math.max(titleColumn.implicitHeight, line.message === "" ? statsRow.implicitHeight : messageText.implicitHeight)

  Column {
    id: titleColumn
    anchors.left: parent.left
    anchors.leftMargin: Style.space(16)
    anchors.verticalCenter: parent.verticalCenter
    spacing: Style.space(3)

    Text {
      textFormat: Text.PlainText
      text: line.title
      color: Qt.darker(line.bar.foreground, 1.4)
      font.family: line.bar.fontFamily
      font.pixelSize: Style.font.body
      font.letterSpacing: 1
    }
    Text {
      visible: text !== ""
      textFormat: Text.PlainText
      text: line.stale ? Cache.formatAge(line.ageMs) : line.subtitle
      color: Qt.darker(line.bar.foreground, 1.5)
      font.family: line.bar.fontFamily
      font.pixelSize: Style.font.caption
      font.italic: line.stale
      // Long spot names must not run into the stats.
      width: Math.min(implicitWidth, line.width * 0.35)
      elide: Text.ElideRight
    }
  }

  Row {
    id: statsRow
    visible: line.message === ""
    anchors.right: parent.right
    anchors.rightMargin: Style.space(20)
    anchors.verticalCenter: parent.verticalCenter
    spacing: Style.space(28)
  }

  Text {
    id: messageText
    visible: line.message !== ""
    anchors.right: parent.right
    anchors.rightMargin: Style.space(20)
    anchors.verticalCenter: parent.verticalCenter
    textFormat: Text.PlainText
    text: line.message
    color: Qt.darker(line.bar.foreground, 1.5)
    font.family: line.bar.fontFamily
    font.pixelSize: Style.font.bodySmall
    font.italic: true
  }
}
