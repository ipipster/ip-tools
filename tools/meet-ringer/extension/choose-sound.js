// Separate window for picking the custom ringtone: browsers close the toolbar popup when a
// file dialog opens, so the popup itself cannot receive the chosen file.
const MAX = 3 * 1024 * 1024;
const status = document.getElementById('status');
document.getElementById('file').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > MAX) { status.className = 'err'; status.textContent = 'This file is larger than 3 MB. Pick a shorter sound.'; return; }
  const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  try {
    const ctx = new AudioContext();
    await ctx.decodeAudioData(await (await fetch(data)).arrayBuffer());
    ctx.close();
  } catch (err) { status.className = 'err'; status.textContent = 'This file cannot be played by the browser. Try a wav or mp3.'; return; }
  await chrome.storage.local.set({ customTone: { name: f.name, data } });
  const { settings = {} } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...settings, ringtone: 'custom' } });
  status.className = ''; status.textContent = `Saved: ${f.name}. This window closes now.`;
  setTimeout(() => window.close(), 1200);
};
