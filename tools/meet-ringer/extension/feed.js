// Runs on the Apps Script result page, only in the short-lived tab the background opened.
// Reads the JSON the calendar feed returned and hands it to the background.
chrome.runtime.sendMessage({ type: 'amIFeed' }, (res) => {
  if (chrome.runtime.lastError || !res || !res.feed) return;
  let sent = false;
  const send = () => {
    if (sent || !document.body) return;
    const text = (document.body.innerText || '').trim();
    if (!text) return;
    sent = true;
    chrome.runtime.sendMessage({ type: 'feedText', text });
  };
  send();
  if (!sent) setTimeout(send, 1500);
});
