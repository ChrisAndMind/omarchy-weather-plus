import QtQuick
import qs.Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "chrisvb.weather-plus" // plus:

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = root.activeButton // plus:
    if ("hostWidget" in target) target.hostWidget = root
  }

  function refresh() {
    if (panelLoader.item && panelLoader.item.refresh) panelLoader.item.refresh()
  }

  function togglePanel() {
    if (panelLoader.item && panelLoader.item.toggle) panelLoader.item.toggle()
  }

  // Shape contract for shell.summon/hide/toggle routing (Bar.findPanelWidget
  // requires open/close/opened on the bar-widget root). Open maps to the
  // panel's hotkey path so summoning suppresses the center hover reveal,
  // matching what the old per-plugin IpcHandler did.
  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false

  function open() {
    if (panelLoader.item && panelLoader.item.openFromHotkey) panelLoader.item.openFromHotkey()
  }

  function close() {
    if (panelLoader.item && panelLoader.item.close) panelLoader.item.close()
  }

  // Forwarded so this widget can stand in for the panel as the bar's popout
  // identity: Bar.requestPopout prefers closeForPopoutSwitch over close, and
  // KeyboardPanel reads popoutSwitchClosing back off its owner.
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  visible: panelLoader.item && panelLoader.item.label !== ""
  // plus: a module's text beside the icon (Settings › In the bar) swaps the
  // fixed-width icon button for a text button. Vertical bars keep the icon.
  readonly property string pillText: panelLoader.item && !root.vertical ? panelLoader.item.pillText : ""
  readonly property Item activeButton: pillText !== "" ? textButton : button
  implicitWidth: activeButton.implicitWidth
  implicitHeight: activeButton.implicitHeight

  function handlePress(b) {
    if (!root.bar) return
    if (b === Qt.RightButton) root.bar.run("omarchy-notification-send \"$(omarchy-weather-status)\"")
    else if (b === Qt.MiddleButton) root.refresh()
    else root.togglePanel()
  }

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()
  onActiveButtonChanged: injectPanel() // plus:

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  BarIconButton {
    id: button
    visible: root.activeButton === button // plus:
    anchors.fill: parent
    bar: root.bar
    text: panelLoader.item ? panelLoader.item.label : ""
    slotSize: Style.bar.statusSlot
    // Tooltip suppressed because the panel is the detail view.
    tooltipText: ""

    onPressed: function(b) { root.handlePress(b) }
  }

  // plus:
  WidgetButton {
    id: textButton
    visible: root.activeButton === textButton
    anchors.fill: parent
    bar: root.bar
    text: (panelLoader.item ? panelLoader.item.label : "") + "  " + root.pillText
    tooltipText: ""
    onPressed: function(b) { root.handlePress(b) }
  }
}
