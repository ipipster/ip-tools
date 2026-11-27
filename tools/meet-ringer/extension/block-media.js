// Runs in the page (MAIN world) before Meet's own code, only in watch tabs (#meetringer-watch).
// 1. Blocks camera and mic, so the camera light never turns on while we peek at the pre-join screen.
// 2. Makes the background tab behave like a visible one. Meet renders its UI through
//    requestAnimationFrame, which browsers pause in hidden tabs, so "X is in this call" would
//    only appear when you switch to the tab. We report the page as visible and run the
//    animation-frame callbacks on a timer while the tab is really hidden.
(() => {
  if (!location.hash.includes('meetringer-watch')) return;

  // --- camera and mic ---
  const md = navigator.mediaDevices;
  if (md) {
    try {
      md.getUserMedia = () => Promise.reject(new DOMException('Blocked by Meet Ringer', 'NotAllowedError'));
      md.enumerateDevices = () => Promise.resolve([]);
    } catch (e) { /* ignore */ }
  }

  // --- visibility ---
  const proto = Document.prototype;
  const realVis = Object.getOwnPropertyDescriptor(proto, 'visibilityState');
  const reallyHidden = () => (realVis && realVis.get ? realVis.get.call(document) : 'visible') !== 'visible';
  try {
    Object.defineProperty(proto, 'visibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(proto, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(proto, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(proto, 'webkitHidden', { get: () => false, configurable: true });
  } catch (e) { /* ignore */ }
  const swallow = (e) => e.stopImmediatePropagation();
  for (const t of ['visibilitychange', 'webkitvisibilitychange']) {
    window.addEventListener(t, swallow, true);
    document.addEventListener(t, swallow, true);
  }

  // --- animation frames while hidden ---
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCAF = window.cancelAnimationFrame.bind(window);
  const queue = new Map();
  let nextId = 1e9;
  window.requestAnimationFrame = (cb) => {
    if (!reallyHidden()) return nativeRAF(cb);
    const id = nextId++;
    queue.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => { if (queue.has(id)) queue.delete(id); else nativeCAF(id); };
  const flush = () => {
    if (!queue.size) return;
    const cbs = [...queue.values()];
    queue.clear();
    const t = performance.now();
    for (const cb of cbs) { try { cb(t); } catch (e) { setTimeout(() => { throw e; }); } }
  };
  // Meet's Trusted Types policy blocks blob workers, so a page timer is the only option here.
  setInterval(flush, 250);
})();
