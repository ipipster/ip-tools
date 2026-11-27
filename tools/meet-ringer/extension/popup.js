const $ = id => document.getElementById(id);
const fmt = ms => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const send = msg => chrome.runtime.sendMessage(msg);
if ($('version')) $('version').textContent = `- v${chrome.runtime.getManifest().version}`;

// ---------- ringtone picker ----------
// Built-in tones are listed straight away, so the picker is never empty; the sounds folder
// group (cached list, see tones.js) is added after it, and "My own sound file..." last.
function addGroup(sel, label, items) {
  if (!items.length) return;
  const g = document.createElement('optgroup'); g.label = label;
  for (const [value, text] of items) g.appendChild(new Option(text, value));
  sel.appendChild(g);
}
async function fillTones(forceRefresh = false) {
  const sel = $('ringtone'), keep = sel.value;
  let list = [], note = '';
  try {
    const { folderTonesAt } = await chrome.storage.local.get('folderTonesAt');
    list = forceRefresh || !folderTonesAt ? await refreshFolderTones() : await folderTones();
    note = list.length
      ? `${list.length} sound${list.length > 1 ? 's' : ''} in the sounds folder.`
      : 'Sounds folder is empty. The cog opens the extension details: the "Loaded from" path under Source opens the folder. Run add-sounds-windows.bat (Windows) or add-sounds-mac.sh (Mac) there, then click Refresh.';
  } catch (e) {
    note = `Could not read the sounds folder: ${e.message}`;
  }
  sel.innerHTML = '';
  addGroup(sel, 'Built-in', Object.keys(TONES).filter(k => TONES[k].synth).map(k => [k, TONES[k].label]));
  addGroup(sel, 'Sounds folder', list.map(t => [t.key, t.label]));
  addGroup(sel, 'Your own', [['custom', TONES.custom.label]]);
  sel.value = keep && [...sel.options].some(o => o.value === keep) ? keep : DEFAULT_TONE;
  $('soundsStatus').textContent = `Saved as soon as you pick it. ${note}`;
}
addGroup($('ringtone'), 'Built-in', Object.keys(TONES).filter(k => TONES[k].synth).map(k => [k, TONES[k].label]));
let tonesReady = fillTones();
// Browsers do not let an extension open a local folder. The extension's details page shows
// its folder as a link ("Source"): one click there opens it, and sounds\ is inside.
$('openSounds').onclick = () => chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
$('refreshSounds').onclick = async () => {
  $('refreshSounds').disabled = true;
  tonesReady = fillTones(true);
  try { await tonesReady; } catch (e) { /* built-in tones are already listed */ }
  $('refreshSounds').disabled = false;
};

// ---------- preview ----------
// One preview at a time. The button toggles Preview / Stop; the 8-second auto-stop only
// resets the button if that same preview is still the current one.
let preview = null; // { stop, timer }
const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const ICON_STOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"/></svg>';
function setPreviewButton(playing) {
  const b = $('preview');
  b.innerHTML = playing ? ICON_STOP : ICON_PLAY;
  b.title = playing ? 'Stop' : 'Preview';
  b.setAttribute('aria-label', b.title);
}
function stopPreviewNow() {
  if (!preview) return;
  preview.stop(); clearTimeout(preview.timer); preview = null;
  setPreviewButton(false);
}
function startPreview(tone) {
  stopPreviewNow();
  const p = { stop: playTone(tone, 8) };
  p.timer = setTimeout(() => { if (preview === p) { preview = null; setPreviewButton(false); } }, 8000);
  preview = p;
  setPreviewButton(true);
}
$('preview').onclick = () => { if (preview) stopPreviewNow(); else startPreview($('ringtone').value); };
window.addEventListener('pagehide', stopPreviewNow);

function showSections() {
  $('helperBox').hidden = $('joinIn').value !== 'helper';
  $('customBox').hidden = $('ringtone').value !== 'custom';
  chrome.storage.local.get('customTone').then(({ customTone }) => {
    $('customStatus').textContent = customTone && customTone.name
      ? `Current file: ${customTone.name}. Choose another file to replace it.`
      : 'No file chosen yet: the previous ringtone stays until you pick an audio file (wav, mp3, m4a, ogg, up to 3 MB).';
  });
}

// A ringtone is saved as soon as it is picked (no Save needed). "My own sound file..." is only
// saved once a file has been chosen; until then the previous ringtone stays in use.
async function hasCustomFile() {
  const { customTone } = await chrome.storage.local.get('customTone');
  return !!(customTone && customTone.data);
}
$('ringtone').onchange = async () => {
  showSections();
  const v = $('ringtone').value;
  if (v === 'custom' && !(await hasCustomFile())) { stopPreviewNow(); return; } // wait for a file
  await send({ type: 'saveSettings', settings: { ringtone: v } });
  startPreview(v);
};

$('chooseSound').onclick = () => chrome.windows.create({ url: 'choose-sound.html', type: 'popup', width: 460, height: 260, focused: true });
// The chooser window saves the file; show it here if the popup is still open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.customTone) { $('ringtone').value = 'custom'; showSections(); }
});

$('keepWatching').onchange = () => send({ type: 'saveSettings', settings: { keepWatching: $('keepWatching').checked } });

async function render() {
  const st = await chrome.storage.local.get(['settings', 'events', 'watches', 'fetchedAt', 'fetchError', 'log', 'handled', 'snoozed']);
  const s = { leadMin: 3, lateMin: 15, ringSec: 30, icalUrl: '', authuser: '', ringtone: DEFAULT_TONE, snoozeMin: 5, keepWatching: false, joinIn: 'tab', launcher: '', ...(st.settings || {}) };
  if (s.joinIn === 'app') s.joinIn = 'tab';
  try { await tonesReady; } catch (e) { /* built-in tones are already listed */ }
  s.ringtone = normalizeToneKey(s.ringtone);
  if (s.ringtone === 'custom' && !(await hasCustomFile())) s.ringtone = DEFAULT_TONE; // own file chosen but never picked
  if (![...$('ringtone').options].some(o => o.value === s.ringtone)) s.ringtone = DEFAULT_TONE;
  for (const k of ['icalUrl', 'leadMin', 'lateMin', 'ringSec', 'authuser', 'ringtone', 'snoozeMin', 'joinIn', 'launcher']) if (document.activeElement !== $(k)) $(k).value = s[k];
  $('keepWatching').checked = !!s.keepWatching;
  showSections();

  const w = Object.entries(st.watches || {});
  $('watches').innerHTML = '';
  if (!w.length) $('watches').innerHTML = '<li class="status">Not watching anything right now.</li>';
  for (const [key, x] of w) {
    const li = document.createElement('li');
    li.innerHTML = `<span></span><span class="t">until ${fmt(x.until)} <button class="x" title="Stop watching">✕</button></span>`;
    li.firstChild.textContent = x.title;
    li.querySelector('button').onclick = async () => { await send({ type: 'stopWatch', key }); render(); };
    $('watches').appendChild(li);
  }

  const now = Date.now();
  const upcoming = (st.events || []).filter(e => e.start > now - 15 * 60000).slice(0, 6);
  $('events').innerHTML = '';
  const handled = st.handled || {}, snoozed = st.snoozed || {}, watching = st.watches || {};
  for (const e of upcoming) {
    const li = document.createElement('li');
    li.innerHTML = `<span></span><span class="t"></span>`;
    li.firstChild.textContent = e.title;
    const t = li.lastChild;
    const running = now < (e.end || e.start + 3600000);
    if (watching[e.key]) t.insertAdjacentHTML('beforeend', '<span class="tag on">● Watching</span>');
    else if (snoozed[e.key]) t.insertAdjacentHTML('beforeend', `<span class="tag warn">Snoozed to ${fmt(snoozed[e.key].at)}</span>`);
    else if (handled[e.key] && running) {
      t.insertAdjacentHTML('beforeend', '<span class="tag warn">✓ Handled</span><button class="mini">Rewatch</button>');
      t.querySelector('button').onclick = async () => { await send({ type: 'rewatch', key: e.key }); render(); };
    }
    t.insertAdjacentText('beforeend', fmt(e.start));
    $('events').appendChild(li);
  }
  $('calStatus').className = '';
  if (!s.icalUrl) $('calStatus').textContent = 'Add a calendar feed URL, or open a Meet link and click Watch this meeting.';
  else if (st.fetchError) { $('calStatus').textContent = st.fetchError; $('calStatus').className = 'err'; }
  else $('calStatus').textContent = upcoming.length ? `Updated: ${st.fetchedAt ? fmt(st.fetchedAt) : '-'}` : 'No meetings with a Meet link in the next 24 hours.';

  if (st.log && st.log.length) $('log').textContent = st.log.slice().reverse().join('\n');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  $('watchCurrent').disabled = !(tab && /meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(tab.url || ''));
}

$('save').onclick = async () => {
  await send({ type: 'saveSettings', settings: {
    icalUrl: $('icalUrl').value.trim(),
    leadMin: Number($('leadMin').value) || 0,
    lateMin: Number($('lateMin').value) || 15,
    ringSec: Number($('ringSec').value) || 30,
    authuser: $('authuser').value.trim(),
    ...($('ringtone').value !== 'custom' || (await hasCustomFile()) ? { ringtone: $('ringtone').value } : {}),
    snoozeMin: Number($('snoozeMin').value) || 5,
    keepWatching: $('keepWatching').checked,
    joinIn: $('joinIn').value,
    launcher: $('launcher').value.trim()
  }});
  render();
};
$('refresh').onclick = async () => { await send({ type: 'refresh' }); render(); };
$('test').onclick = () => send({ type: 'testRing' });
$('watchCurrent').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await send({ type: 'watchCurrent', url: tab.url, title: tab.title.replace(/^Meet\s*[-–]\s*/, '') });
  render();
};
$('copyLog').onclick = async () => {
  const { log = [] } = await chrome.storage.local.get('log');
  await navigator.clipboard.writeText(log.join('\n'));
  $('copyLog').textContent = 'Copied';
};
$('clearLog').onclick = async () => { await send({ type: 'clearLog' }); $('log').textContent = 'No data yet.'; };
$('joinIn').onchange = showSections;
$('checkHelper').onclick = async () => {
  $('helperStatus').textContent = 'Checking...';
  const res = await send({ type: 'checkHelper' });
  $('helperStatus').textContent = res && res.ok ? 'Helper installed and working.' : `Not working: ${res && res.error}`;
};
render();
let renderTimer = null;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !['watches', 'handled', 'snoozed', 'events', 'fetchError', 'fetchedAt'].some(k => k in changes)) return;
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 150);
});
