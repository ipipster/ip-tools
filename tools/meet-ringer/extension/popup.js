const $ = id => document.getElementById(id);
const fmt = ms => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const send = msg => chrome.runtime.sendMessage(msg);

async function render() {
  const st = await chrome.storage.local.get(['settings', 'events', 'watches', 'fetchedAt', 'fetchError', 'log']);
  const s = { leadMin: 3, lateMin: 15, ringSec: 30, icalUrl: '', authuser: '', joinIn: 'tab', launcher: '', ...(st.settings || {}) };
  if (s.joinIn === 'app') s.joinIn = 'tab';
  for (const k of ['icalUrl', 'leadMin', 'lateMin', 'ringSec', 'authuser', 'joinIn', 'launcher']) if (document.activeElement !== $(k)) $(k).value = s[k];

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
  for (const e of upcoming) {
    const li = document.createElement('li');
    li.innerHTML = `<span></span><span class="t">${fmt(e.start)}</span>`;
    li.firstChild.textContent = e.title;
    $('events').appendChild(li);
  }
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
$('joinIn').onchange = () => { $('helperBox').hidden = $('joinIn').value !== 'helper'; };
$('checkHelper').onclick = async () => {
  $('helperStatus').textContent = ' Checking...';
  const res = await send({ type: 'checkHelper' });
  $('helperStatus').textContent = res && res.ok ? ' Helper installed and working' : ` Not working: ${res && res.error}`;
};
render().then(() => { $('helperBox').hidden = $('joinIn').value !== 'helper'; });
