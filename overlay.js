const isPopup = new URLSearchParams(location.search).has('window');
document.body.classList.toggle('popup', isPopup);
const caption = document.querySelector('.caption');
const cards = document.querySelector('.cards');
let tabs = [];
let index = 0;
let done = false;
let pointerMoved = false;
let lastLocalStep = 0;

const favicon = (url) => {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', url);
  u.searchParams.set('size', '32');
  return u.toString();
};

const toParent = (message) => window.parent.postMessage(message, '*');

function render() {
  cards.replaceChildren(...tabs.map((tab, i) => {
    const card = document.createElement('button');
    card.className = 'card';
    const preview = document.createElement('div');
    preview.className = 'preview';
    const img = document.createElement('img');
    if (tab.thumb) img.src = tab.thumb;
    else {
      img.className = 'placeholder';
      img.src = favicon(tab.url);
    }
    preview.appendChild(img);
    const badge = document.createElement('img');
    badge.className = 'badge';
    badge.src = favicon(tab.url);
    card.append(preview, badge);
    card.addEventListener('mousemove', () => { if (pointerMoved && i !== index) hover(i); });
    card.addEventListener('click', () => pick(i));
    return card;
  }));
  show(index);
}

function show(i) {
  index = i;
  [...cards.children].forEach((c, j) => c.classList.toggle('selected', j === index));
  caption.textContent = tabs[index]?.title ?? '';
  cards.children[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function hover(i) {
  if (isPopup) show(i);
  else toParent({ type: 'hover', index: i });
}

function pick(i) {
  if (!isPopup) return toParent({ type: 'pick', index: i });
  if (done) return;
  chrome.runtime.sendMessage({ type: 'activate', tabId: tabs[i].id });
  dismiss();
}

function dismiss() {
  if (!isPopup) return toParent({ type: 'dismiss' });
  if (done) return;
  done = true;
  chrome.runtime.sendMessage({ type: 'close-window' }).finally(() => window.close());
}

function onPopupKey(type, key, shift) {
  if (type === 'keyup' && key === 'Control') return pick(index);
  if (type !== 'keydown') return;
  if (key.toLowerCase() === 'q') {
    lastLocalStep = Date.now();
    return show((index + (shift ? -1 : 1) + tabs.length) % tabs.length);
  }
  if (key === 'Escape') dismiss();
  else if (key === 'Enter') pick(index);
  else if (key === 'ArrowRight') show((index + 1) % tabs.length);
  else if (key === 'ArrowLeft') show((index - 1 + tabs.length) % tabs.length);
}

for (const type of ['keydown', 'keyup']) {
  window.addEventListener(type, (e) => {
    if (isPopup) onPopupKey(type, e.key, e.shiftKey);
    else toParent({ type: 'key', event: type, key: e.key, shift: e.shiftKey });
  });
}
window.addEventListener('mousemove', (e) => { if (e.movementX || e.movementY) pointerMoved = true; });
document.addEventListener('click', (e) => { if (!e.target.closest('.card')) dismiss(); });
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const card = e.target.closest('.card');
  if (card) card.click();
  else dismiss();
});

if (isPopup) {
  window.addEventListener('blur', dismiss);
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type !== 'step' || done || !tabs.length) return;
    if (Date.now() - lastLocalStep > 250) show((index + msg.dir + tabs.length) % tabs.length);
    sendResponse(true);
  });
  chrome.runtime.sendMessage({ type: 'state' }).then((state) => {
    if (!state) return dismiss();
    tabs = state.tabs;
    index = state.index;
    render();
    window.focus();
  });
} else {
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent) return;
    if (e.data?.type === 'render') {
      tabs = e.data.tabs;
      index = e.data.index;
      render();
    }
    if (e.data?.type === 'select') show(e.data.index);
  });
  toParent({ type: 'ready' });
}
