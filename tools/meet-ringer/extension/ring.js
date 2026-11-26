const key = new URLSearchParams(location.search).get('key');
chrome.storage.local.get('ringing').then(({ ringing = {} }) => {
  const r = ringing[key];
  if (!r) return;
  const time = new Date(r.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('who').textContent = `${r.who} joined`;
  document.getElementById('title').textContent = r.title;
  document.getElementById('when').textContent = `at ${time}`;
  document.title = `${r.who} joined`;
  setTimeout(() => document.body.classList.remove('ringing'), (r.ringSec || 30) * 1000);
});
// "tab" mode: open the meeting with a real link click, so an installed Meet app that
// captures Meet links (its "Open supported links" setting) opens it instead of a browser tab.
document.getElementById('join').onclick = async () => {
  const { ringing = {}, settings = {} } = await chrome.storage.local.get(['ringing', 'settings']);
  const r = ringing[key];
  const joinIn = settings.joinIn || 'tab';
  if (!r || !r.code || joinIn !== 'tab') return chrome.runtime.sendMessage({ type: 'join', key });
  let url = `https://meet.google.com/${r.code}`;
  if (settings.authuser) url += `?authuser=${encodeURIComponent(settings.authuser)}`;
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => chrome.runtime.sendMessage({ type: 'joinedByLink', key }), 400);
};
document.getElementById('dismiss').onclick = () => chrome.runtime.sendMessage({ type: 'dismiss', key });
