// Runs on meet.google.com. Only acts in tabs opened by the Join button (#meetringer-join):
// turns mic and camera off, confirms both are off, then clicks "Join now" / "Ask to join".
(() => {
  if (!location.hash.includes('meetringer-join')) return;
  history.replaceState(null, '', location.pathname + location.search);

  const TIMEOUT_MS = 25000;
  const started = Date.now();
  let done = false;

  const buttons = () => [...document.querySelectorAll('button, [role="button"]')];
  const label = el => `${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-tooltip') || ''}`.toLowerCase();
  const text = el => (el.innerText || '').trim().toLowerCase();

  function device(kind) {
    const re = kind === 'mic' ? /microphone/ : /camera/;
    const el = buttons().find(b => re.test(label(b)) && /turn (on|off)/.test(label(b)));
    if (!el) return { el: null, state: 'unknown' };
    const muted = el.getAttribute('data-is-muted');
    if (muted === 'true' || /turn on/.test(label(el))) return { el, state: 'off' };
    if (muted === 'false' || /turn off/.test(label(el))) return { el, state: 'on' };
    return { el, state: 'unknown' };
  }

  function log(msg) { try { chrome.runtime.sendMessage({ type: 'joinLog', text: msg }); } catch (e) { /* ignore */ } }

  function step() {
    if (done) return;
    if (Date.now() - started > TIMEOUT_MS) {
      done = true;
      log('Auto-join gave up: could not confirm mic and camera are off. Join manually.');
      return;
    }

    const without = buttons().find(b => /continue without (microphone|camera)/.test(text(b)));
    if (without) { without.click(); return; }

    const mic = device('mic'), cam = device('cam');
    if (mic.state === 'on') { mic.el.click(); return; }
    if (cam.state === 'on') { cam.el.click(); return; }
    if (mic.state !== 'off' || cam.state !== 'off') return;

    const join = buttons().find(b => /^(join now|ask to join)$/.test(text(b)));
    if (!join) return;
    done = true;
    join.click();
    log(`Auto-joined with mic and camera off (${text(join)}).`);
  }

  const timer = setInterval(() => { step(); if (done) clearInterval(timer); }, 600);
})();
