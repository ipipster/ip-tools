let stopCurrent = null;

function start(seconds, tone, opts) {
  stop();
  stopCurrent = playTone(tone, seconds, opts || {});
}

function stop() {
  if (stopCurrent) { stopCurrent(); stopCurrent = null; }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== 'offscreen') return;
  if (msg.type === 'start') start(msg.seconds || 30, msg.tone, msg.opts);
  if (msg.type === 'stop') stop();
});
