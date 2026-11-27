// Ringtones shared by the popup (picker, preview) and the offscreen page (ringing).
//  - Built-in: tones generated with Web Audio. Work on every computer, need no files.
//  - Sounds folder: audio files in sounds/, listed in sounds/index.txt. The loaders
//    (add-sounds-mac.sh on Mac, add-sounds-windows.bat on Windows) copy sounds there and
//    rewrite index.txt. The popup's Refresh button reads index.txt and caches the list
//    in storage ("folderTones"), so the folder is not re-read every time.
//  - My own sound file: one file picked in the popup, kept in local storage.
// The offscreen page that rings cannot read chrome.storage, so the background passes the
// sound data (own file) and gap (sounds folder) along: playTone(name, seconds, { data, gap }).
// The sounds/ folder is never committed (Apple, Microsoft and Slack own those sounds).
const TONES = {
  classic: { label: 'Classic (two-tone beep)', synth: 'classic' },
  chime:   { label: 'Chime', synth: 'chime' },
  bell:    { label: 'Old phone bell', synth: 'bell' },
  digital: { label: 'Digital', synth: 'digital' },
  custom:  { label: 'My own sound file...', custom: true, gap: 0.8 }
};
const DEFAULT_TONE = 'classic';
const CUSTOM_MAX_BYTES = 3 * 1024 * 1024;
const FOLDER_PREFIX = 'f:';           // folder tone keys look like "f:Ring05.wav"
const AUDIO_RE = /\.(wav|mp3|m4a|ogg|oga|aac|flac|webm)$/i;

function note(ctx, at, freq, dur, vol = 0.3, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at); o.stop(at + dur + 0.02);
}

// Each built-in tone: one burst, repeated every "period" seconds.
const SYNTH = {
  classic: { period: 2.5, burst(ctx, at) {
    for (const f of [660, 880]) for (const t of [0, 0.5]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const s = at + t;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.35, s + 0.02);
      g.gain.setValueAtTime(0.35, s + 0.38);
      g.gain.linearRampToValueAtTime(0, s + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(s); o.stop(s + 0.42);
    }
  } },
  chime: { period: 2.2, burst(ctx, at) {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(ctx, at + i * 0.16, f, 0.9, 0.28, 'triangle'));
  } },
  bell: { period: 3, burst(ctx, at) {
    for (const start of [0, 0.6]) for (let i = 0; i < 10; i++) note(ctx, at + start + i * 0.04, i % 2 ? 1400 : 1150, 0.05, 0.18, 'square');
  } },
  digital: { period: 1.6, burst(ctx, at) {
    for (let i = 0; i < 4; i++) note(ctx, at + i * 0.13, 1250, 0.08, 0.25, 'square');
  } }
};

// Reads sounds/index.txt ("file|label|gap" per line; label and gap optional), keeps only
// entries whose file really exists, and caches the result. Returns the list.
async function refreshFolderTones() {
  let text = '';
  try {
    const r = await fetch(chrome.runtime.getURL('sounds/index.txt'), { cache: 'no-store' });
    if (r.ok) text = await r.text();
  } catch (e) { /* no sounds folder */ }
  const list = [];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const [file, label, gap] = raw.split('|').map(x => (x || '').trim());
    if (!file || !AUDIO_RE.test(file) || file.includes('/') || file.includes('\\')) continue;
    try {
      const r = await fetch(chrome.runtime.getURL(`sounds/${encodeURIComponent(file)}`), { cache: 'no-store' });
      if (!r.ok) continue;
    } catch (e) { continue; }
    list.push({ key: FOLDER_PREFIX + file, file, label: label || file.replace(AUDIO_RE, ''), gap: gap === '' || gap == null ? 0.8 : Number(gap) || 0 });
  }
  await chrome.storage.local.set({ folderTones: list, folderTonesAt: Date.now() });
  return list;
}

async function folderTones() {
  const { folderTones: list } = await chrome.storage.local.get('folderTones');
  return list || [];
}

// Settings saved by 1.2.0 test builds used keys like "iphone-reflection" for Mac sounds.
function normalizeToneKey(key) {
  if (!key || TONES[key] || String(key).startsWith(FOLDER_PREFIX)) return key || DEFAULT_TONE;
  return `${FOLDER_PREFIX}${key}.m4a`;
}

async function loadToneBuffer(ctx, key, data) {
  let url;
  if (key === 'custom' && data) {
    url = data;
  } else if (key === 'custom') {
    const { customTone } = await chrome.storage.local.get('customTone');
    if (!customTone || !customTone.data) throw new Error('no custom sound');
    url = customTone.data;
  } else {
    url = chrome.runtime.getURL(`sounds/${encodeURIComponent(key.slice(FOLDER_PREFIX.length))}`);
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error('sound file missing');
  return ctx.decodeAudioData(await r.arrayBuffer());
}

function playTone(name, seconds, opts = {}) {
  const key = normalizeToneKey(name);
  const ctx = new AudioContext();
  let loop = null, stopped = false;
  const timer = setTimeout(stop, seconds * 1000);

  const playSynth = (id) => {
    const s = SYNTH[id] || SYNTH.classic;
    s.burst(ctx, ctx.currentTime + 0.05);
    loop = setInterval(() => s.burst(ctx, ctx.currentTime + 0.05), s.period * 1000);
  };

  if (TONES[key] && TONES[key].synth) playSynth(TONES[key].synth);
  else {
    const gapP = opts.gap != null ? Promise.resolve(opts.gap)
      : key === 'custom' ? Promise.resolve(TONES.custom.gap)
      : folderTones().then(list => { const m = list.find(t => t.key === key); return m ? m.gap : 0.8; });
    Promise.all([loadToneBuffer(ctx, key, opts.data), gapP])
      .then(([buf, gap]) => {
        if (stopped) return;
        const playOnce = () => { const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start(); };
        playOnce();
        loop = setInterval(playOnce, (buf.duration + gap) * 1000);
      })
      .catch(() => { if (!stopped) playSynth('classic'); }); // missing or unreadable file: classic beep
  }

  function stop() { stopped = true; clearInterval(loop); clearTimeout(timer); ctx.close().catch(() => {}); }
  return stop;
}
