const area = document.querySelector('textarea');

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'copy') return;
  area.value = msg.text;
  area.select();
  sendResponse(document.execCommand('copy'));
});
