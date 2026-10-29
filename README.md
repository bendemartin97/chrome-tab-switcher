# Tab Switcher

Arc-style tab switcher for Chrome: hold <kbd>⌃</kbd> and press <kbd>Q</kbd> to see your tabs with live previews, ordered by most recently used. Release <kbd>⌃</kbd> to jump.

- **Tap** <kbd>⌃Q</kbd> to jump straight back to the previous tab.
- **Hold** <kbd>⌃</kbd> and press <kbd>Q</kbd> repeatedly to move forward, <kbd>⌃⇧Q</kbd> to move back.
- Arrow keys, <kbd>Enter</kbd>, <kbd>Esc</kbd> and clicks work while the switcher is open.
- Previews are captured when a tab becomes active and kept for the browser session only.
- On pages extensions cannot draw on (`chrome://…`, Chrome Web Store) the switcher opens as a small centered window.

## Install

1. Clone this repo.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and pick the folder.
3. Check the shortcuts under `chrome://extensions/shortcuts`.

## Ctrl+Tab (macOS)

Chrome does not let extensions bind <kbd>Ctrl+Tab</kbd>. The optional helper in `helper/` rewrites <kbd>Ctrl+Tab</kbd> to <kbd>⌃Q</kbd> (and <kbd>Ctrl+Shift+Tab</kbd> to <kbd>⌃⇧Q</kbd>) while Chrome is the frontmost app, so the switcher takes over Ctrl+Tab and Chrome's own positional tab cycling goes away. Other apps keep their Ctrl+Tab.

```sh
./helper/install.sh            # build ~/Applications/ChromeCtrlTab.app and start it at login
./helper/install.sh uninstall  # stop and remove
```

On first start, allow **ChromeCtrlTab** under System Settings → Privacy & Security → Accessibility. Requires the Xcode command line tools (`swiftc`).

## License

MIT
