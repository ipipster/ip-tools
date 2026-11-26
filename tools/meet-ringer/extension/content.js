// Runs on meet.google.com. Only does anything in tabs the background opened as watch tabs.
// Reads the pre-join screen ("X is in this call") and reports who is already inside.

const PRESENT_PATTERNS = [
  /^(.+?)\s+(?:is|are)\s+in\s+(?:this|the)\s+call\.?$/i,
  /^(.+?)\s+(?:is|are)\s+presenting\.?$/i,
  /^(.+?)\s+(?:vesz|vesznek)\s+részt\s+a\s+hívásban\.?$/i,
  /^(.+?)\s+(?:van|vannak)\s+(?:már\s+)?(?:bent\s+)?a\s+hívásban\.?$/i,
  /^(.+?)\s+(?:van|vannak)\s+(?:már\s+)?a\s+megbeszélésen\.?$/i,
  /^A\s+hívásban\s+(?:van|vannak|részt\s+vesz|részt\s+vesznek)\s*:?\s*(.+)$/i
];
const EMPTY_PATTERNS = [
  /no one else is here/i,
  /senki\s+(?:más\s+)?(?:sincs|nincs)\s+(?:még\s+)?itt/i,
  /még\s+senki\s+nincs/i
];

let isWatch = false;
let reported = false;
let lastSnapshot = '';

function scan() {
  if (!isWatch || reported || !document.body) return;
  const text = document.body.innerText || '';
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && l.length < 200);

  for (const line of lines) {
    for (const re of PRESENT_PATTERNS) {
      const m = line.match(re);
      if (m) {
        reported = true;
        chrome.runtime.sendMessage({ type: 'presence', who: m[1].trim(), line });
        return;
      }
    }
  }

  // Diagnostics: keep a short snapshot of the pre-join text so the patterns can be tuned.
  const isEmpty = EMPTY_PATTERNS.some(re => re.test(text));
  const snapshot = `[${document.visibilityState}] ` + (isEmpty ? '[empty] ' : '') + lines.slice(0, 25).join(' | ').slice(0, 600);
  if (snapshot !== lastSnapshot) {
    lastSnapshot = snapshot;
    chrome.runtime.sendMessage({ type: 'snapshot', text: snapshot });
  }
}

// The background may still be saving the watch when the page loads, so ask a few times.
function register(attempt) {
  const last = attempt >= 9;
  chrome.runtime.sendMessage({ type: 'amIWatch', visibility: document.visibilityState, last }, (res) => {
    if (chrome.runtime.lastError) return;
    if (!res || !res.watch) {
      if (!last) setTimeout(() => register(attempt + 1), 1000);
      return;
    }
    isWatch = true;
    scan();
    new MutationObserver(() => scan()).observe(document.documentElement, {
      childList: true, subtree: true, characterData: true
    });
    setInterval(scan, 3000);
  });
}
if (location.hash.includes('meetringer-watch')) register(0);
