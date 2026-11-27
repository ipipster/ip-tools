// Runs on meet.google.com.
// Watch tabs: reads the pre-join screen ("X is in this call") and reports who is already inside.
// Your own Meet tabs: reports when you leave or rejoin, so the meeting can be watched again.

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
  /looking for others in the call/i,
  /senki\s+(?:más\s+)?(?:sincs|nincs)\s+(?:még\s+)?itt/i,
  /még\s+senki\s+nincs/i
];
const SELF_PATTERNS = [/switch here/i, /join here too/i, /already in (?:this|the) call/i, /in this call on another device/i];
const LEFT_PATTERNS = [/you left the meeting/i, /you've left the meeting/i, /you have left the meeting/i];
const ARM_EMPTY_MS = 6000;

const meetCode = (location.pathname.match(/^\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i) || [])[1];

// ---------- watch tabs ----------
let isWatch = false;
let armed = true;
let emptySince = 0;
let reported = false;
let lastSnapshot = '';

function scan() {
  if (!isWatch || reported || !document.body) return;
  const text = document.body.innerText || '';
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && l.length < 200);

  if (SELF_PATTERNS.some(re => re.test(text))) {
    reported = true;
    chrome.runtime.sendMessage({ type: 'selfInCall' });
    return;
  }

  const isEmpty = EMPTY_PATTERNS.some(re => re.test(text));
  if (!armed) {
    emptySince = isEmpty ? (emptySince || Date.now()) : 0;
    if (emptySince && Date.now() - emptySince >= ARM_EMPTY_MS) {
      armed = true;
      chrome.runtime.sendMessage({ type: 'empty' });
    }
  }

  if (armed) {
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
  }

  // Diagnostics: keep a short snapshot of the pre-join text so the patterns can be tuned.
  const snapshot = `[${document.visibilityState}] ` + (isEmpty ? '[empty] ' : '') + (armed ? '' : '[waiting for empty] ') +
    lines.slice(0, 25).join(' | ').slice(0, 600);
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
    armed = res.armed !== false;
    scan();
    new MutationObserver(() => scan()).observe(document.documentElement, {
      childList: true, subtree: true, characterData: true
    });
    setInterval(scan, 3000);
  });
}

// ---------- your own Meet tabs ----------
function watchOwnTab() {
  let left = false;
  setInterval(() => {
    if (!document.body) return;
    const nowLeft = LEFT_PATTERNS.some(re => re.test(document.body.innerText || ''));
    if (nowLeft === left) return;
    left = nowLeft;
    try { chrome.runtime.sendMessage({ type: left ? 'leftMeeting' : 'rejoinedMeeting', code: meetCode.toLowerCase() }); } catch (e) { /* reloaded */ }
  }, 2000);
}

if (location.hash.includes('meetringer-watch')) register(0);
else if (meetCode) watchOwnTab();
