const key = new URLSearchParams(location.search).get('key');
chrome.storage.local.get('ringing').then(({ ringing = {} }) => {
  const r = ringing[key];
  if (!r) return;
  const time = new Date(r.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('who').textContent = `${r.who} joined`;
  const words = String(r.who || '').replace(/\b(and|are|is)\b.*$/i, '').trim().split(/\s+/).filter(Boolean);
  document.getElementById('initials').textContent = ((words[0] || '?')[0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
  document.getElementById('title').textContent = r.title;
  document.getElementById('when').textContent = `at ${time}`;
  document.title = `${r.who} joined`;
  setTimeout(() => document.body.classList.remove('ringing'), (r.ringSec || 30) * 1000);
});
document.getElementById('join').onclick = () => chrome.runtime.sendMessage({ type: 'join', key });
document.getElementById('later').onclick = () => chrome.runtime.sendMessage({ type: 'later', key });
document.getElementById('dismiss').onclick = () => chrome.runtime.sendMessage({ type: 'dismiss', key });
