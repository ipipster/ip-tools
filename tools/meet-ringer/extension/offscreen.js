// Plays a phone-like two-tone ring until stopped or the time runs out.
let ctx = null, loop = null, stopTimer = null;

function burst(at) {
  for (const [freq, offset] of [[660, 0], [880, 0]]) {
    for (const t of [0, 0.5]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      const s = at + t + offset;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.35, s + 0.02);
      g.gain.setValueAtTime(0.35, s + 0.38);
      g.gain.linearRampToValueAtTime(0, s + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(s); o.stop(s + 0.42);
    }
  }
}

function start(seconds) {
  stop();
  ctx = new AudioContext();
  burst(ctx.currentTime + 0.05);
  loop = setInterval(() => burst(ctx.currentTime + 0.05), 2500);
  stopTimer = setTimeout(stop, seconds * 1000);
}

function stop() {
  clearInterval(loop); clearTimeout(stopTimer);
  loop = stopTimer = null;
  if (ctx) { ctx.close(); ctx = null; }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== 'offscreen') return;
  if (msg.type === 'start') start(msg.seconds || 30);
  if (msg.type === 'stop') stop();
});
