// Runs on the Apps Script result page, only in the short-lived tab the background opened.
// Reads the JSON the calendar feed returned and hands it to the background.
chrome.runtime.sendMessage({ type: 'amIFeed' }, (res) => {
  if (chrome.runtime.lastError || !res || !res.feed) return;
  const started = Date.now();
  let sent = false;

  // JSON viewer extensions can wrap the page in their own toolbar, so fall back to the outermost {...}.
  const extract = (text) => {
    try { JSON.parse(text); return text; } catch (e) { /* not plain JSON */ }
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    const inner = text.slice(a, b + 1);
    try { JSON.parse(inner); return inner; } catch (e) { return null; }
  };

  const attempt = () => {
    if (sent) return;
    const raw = (document.querySelector('pre') || document.body || {}).innerText || '';
    const json = extract(raw.trim());
    if (json || Date.now() - started > 6000) {
      sent = true;
      chrome.runtime.sendMessage({ type: 'feedText', text: json || raw.trim() });
      return;
    }
    setTimeout(attempt, 500);
  };
  attempt();
});
