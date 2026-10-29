(() => {
  let ctrlHeld = null;
  let overlay = null;
  let lastLocalStep = 0;

  const send = (message) => overlay?.frame.contentWindow?.postMessage(message, '*');

  function open(tabs, index) {
    if (ctrlHeld === false) {
      chrome.runtime.sendMessage({ type: 'activate', tabId: tabs[index].id });
      return;
    }
    const host = document.createElement('div');
    host.setAttribute('popover', 'manual');
    host.style.cssText = [
      'all:initial', 'display:block', 'position:fixed', 'inset:0', 'width:100vw', 'height:100vh',
      'margin:0', 'padding:0', 'border:0', 'background:transparent', 'overflow:visible',
      'opacity:1', 'visibility:visible', 'transform:none', 'filter:none', 'z-index:2147483647',
    ].map((rule) => `${rule} !important`).join(';');
    const root = host.attachShadow({ mode: 'closed' });
    const frame = document.createElement('iframe');
    frame.src = chrome.runtime.getURL('overlay.html');
    frame.style.cssText = 'all:initial;display:block;position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;color-scheme:dark;';
    root.appendChild(frame);
    document.documentElement.appendChild(host);
    host.showPopover?.();
    overlay = { host, frame, tabs, index };
  }

  function close() {
    overlay?.host.remove();
    overlay = null;
  }

  function select(i) {
    overlay.index = (i + overlay.tabs.length) % overlay.tabs.length;
    send({ type: 'select', index: overlay.index });
  }

  function commit(i = overlay?.index) {
    if (!overlay) return;
    chrome.runtime.sendMessage({ type: 'activate', tabId: overlay.tabs[i].id });
    close();
  }

  function onKey(type, key, shift) {
    if (overlay && type === 'keydown' && ctrlHeld !== false && key.toLowerCase() === 'q') {
      lastLocalStep = Date.now();
      select(overlay.index + (shift ? -1 : 1));
      return true;
    }
    if (key === 'Control') {
      ctrlHeld = type === 'keydown';
      if (!ctrlHeld) commit();
      return false;
    }
    if (!overlay || type !== 'keydown') return false;
    if (key === 'Escape') close();
    else if (key === 'Enter') commit();
    else if (key === 'ArrowRight') select(overlay.index + 1);
    else if (key === 'ArrowLeft') select(overlay.index - 1);
    else return false;
    return true;
  }

  const onKeyEvent = (e) => {
    const handled = onKey(e.type, e.key, e.shiftKey);
    if (handled) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  window.addEventListener('keydown', onKeyEvent, true);
  window.addEventListener('keyup', onKeyEvent, true);
  window.addEventListener('blur', () => setTimeout(() => document.hasFocus() || close()));
  document.addEventListener('visibilitychange', () => document.hidden && close());
  window.addEventListener('contextmenu', (e) => {
    if (!overlay) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  window.addEventListener('message', (e) => {
    if (!overlay || e.source !== overlay.frame.contentWindow) return;
    const msg = e.data ?? {};
    if (msg.type === 'ready') send({ type: 'render', tabs: overlay.tabs, index: overlay.index });
    if (msg.type === 'key') onKey(msg.event, msg.key, msg.shift);
    if (msg.type === 'hover') select(msg.index);
    if (msg.type === 'pick') commit(msg.index);
    if (msg.type === 'dismiss') close();
  });

  function toast() {
    const host = document.createElement('div');
    host.setAttribute('popover', 'manual');
    host.style.cssText = [
      'all:initial', 'display:block', 'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
      'margin:0', 'padding:8px 14px', 'border:0', 'border-radius:10px', 'background:rgb(44 44 46)',
      'color:#f5f5f7', 'font:500 13px/1.3 -apple-system,BlinkMacSystemFont,system-ui,sans-serif',
      'box-shadow:0 8px 30px rgb(0 0 0 / 0.3)', 'z-index:2147483647', 'transition:opacity 0.2s', 'opacity:1',
    ].map((rule) => `${rule} !important`).join(';');
    host.textContent = navigator.language.startsWith('de') ? 'URL kopiert' : 'URL copied';
    document.documentElement.appendChild(host);
    host.showPopover?.();
    setTimeout(() => host.style.setProperty('opacity', '0', 'important'), 1200);
    setTimeout(() => host.remove(), 1500);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'toast') {
      toast();
      sendResponse(true);
    }
    if (msg.type === 'open') {
      close();
      open(msg.tabs, msg.index);
      sendResponse(true);
    }
    if (msg.type === 'step') {
      if (overlay && Date.now() - lastLocalStep > 250) select(overlay.index + msg.dir);
      sendResponse(Boolean(overlay));
    }
  });
})();
