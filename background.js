const THUMB_WIDTH = 480;
const POPUP_URL = chrome.runtime.getURL('overlay.html?window=1');
let queue = Promise.resolve();

async function listTabs(windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  tabs.sort((a, b) => (b.active - a.active) || (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
  const thumbs = await chrome.storage.session.get(tabs.map((t) => `thumb:${t.id}`));
  return tabs.map((t) => ({
    id: t.id,
    title: t.title || t.url,
    url: t.url,
    thumb: thumbs[`thumb:${t.id}`] ?? null,
  }));
}

async function openPopupWindow(win, tabs, index) {
  await chrome.storage.session.set({ pending: { tabs, index } });
  const cols = Math.min(tabs.length, 5);
  const width = cols * 204 + 32;
  const height = Math.ceil(tabs.length / 5) * 135 + 72;
  await chrome.windows.create({
    url: POPUP_URL,
    type: 'popup',
    focused: true,
    width,
    height,
    left: Math.round(win.left + (win.width - width) / 2),
    top: Math.round(win.top + (win.height - height) / 2),
  });
}

async function handle(dir) {
  const [current] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!current) return;
  if (current.url === POPUP_URL) {
    await chrome.runtime.sendMessage({ type: 'step', dir }).catch(() => {});
    return;
  }
  const stepped = await chrome.tabs.sendMessage(current.id, { type: 'step', dir }).catch(() => null);
  if (stepped) return;

  const win = await chrome.windows.get(current.windowId);
  const tabs = await listTabs(win.id);
  if (tabs.length < 2) return;
  const index = dir > 0 ? 1 : tabs.length - 1;
  const message = { type: 'open', tabs, index };
  const opened = await chrome.tabs.sendMessage(current.id, message).catch(() => null);
  if (opened) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: current.id }, files: ['switcher.js'] });
    if (await chrome.tabs.sendMessage(current.id, message)) return;
  } catch {}
  await openPopupWindow(win, tabs, index);
}

const enqueue = (dir) => {
  queue = queue.then(() => handle(dir)).catch(() => {});
};

chrome.commands.onCommand.addListener((command) => enqueue(command === 'prev' ? -1 : 1));
chrome.action.onClicked.addListener(() => enqueue(1));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'state') {
    chrome.storage.session.get('pending').then(({ pending }) => sendResponse(pending ?? null));
    return true;
  }
  if (msg.type === 'close-window' && sender.tab) {
    chrome.windows.remove(sender.tab.windowId).catch(() => {});
  }
  if (msg.type === 'activate') {
    chrome.tabs.update(msg.tabId, { active: true })
      .then((tab) => chrome.windows.update(tab.windowId, { focused: true }))
      .catch(() => {});
  }
});

const captureTimers = new Map();

function scheduleCapture(windowId, tabId, delay = 350) {
  clearTimeout(captureTimers.get(windowId));
  captureTimers.set(windowId, setTimeout(() => capture(windowId, tabId), delay));
}

async function capture(windowId, tabId) {
  try {
    const [active] = await chrome.tabs.query({ windowId, active: true });
    if (!active || active.id !== tabId || active.status !== 'complete') return;
    const shot = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 70 });
    const bitmap = await createImageBitmap(await (await fetch(shot)).blob());
    const scale = THUMB_WIDTH / bitmap.width;
    const canvas = new OffscreenCanvas(THUMB_WIDTH, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    await chrome.storage.session.set({ [`thumb:${tabId}`]: `data:image/jpeg;base64,${btoa(binary)}` });
  } catch {
    // chrome://-Seiten, Quota oder geschlossener Tab: Vorschau bleibt leer
  }
}

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => scheduleCapture(windowId, tabId));
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.active) scheduleCapture(tab.windowId, tabId, 600);
});
chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`thumb:${tabId}`));
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const [active] = await chrome.tabs.query({ windowId, active: true });
  if (active) scheduleCapture(windowId, active.id);
});
