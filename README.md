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

Chrome does not let extensions bind <kbd>Ctrl+Tab</kbd>. To use it anyway, remap <kbd>Ctrl+Tab</kbd> to <kbd>⌃Q</kbd> for Chrome with a tool like Karabiner-Elements.
