import ICAL from './lib/ical.js';

const DEFAULTS = { icalUrl: '', leadMin: 3, lateMin: 15, ringSec: 30, authuser: '', joinIn: 'tab', launcher: '' };
const HELPER = 'com.meetringer.launcher';
const CAL_REFRESH_MS = 10 * 60 * 1000;
const MANUAL_WATCH_MS = 60 * 60 * 1000;
const MEET_CODE_RE = /meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i;

// ---------- storage helpers ----------
async function get(keys) { return chrome.storage.local.get(keys); }
async function set(obj) { return chrome.storage.local.set(obj); }
async function settings() { const { settings: s } = await get('settings'); return { ...DEFAULTS, ...(s || {}) }; }
async function bag(name) { const r = await get(name); return r[name] || {}; }

function meetUrl(code, authuser, watch) {
  let url = `https://meet.google.com/${code}`;
  if (authuser !== '' && authuser != null) url += `?authuser=${encodeURIComponent(authuser)}`;
  if (watch) url += '#meetringer-watch';
  return url;
}

async function log(text) {
  const { log: l = [] } = await get('log');
  const t = new Date().toLocaleTimeString('en-GB');
  l.push(`${t} ${text}`);
  await set({ log: l.slice(-60) });
}

// ---------- calendar ----------
function calendarEmail(icalUrl) {
  const m = icalUrl.match(/\/ical\/([^/]+)\//);
  return m ? decodeURIComponent(m[1]).toLowerCase() : '';
}

function parseIcs(text, email, winStart, winEnd) {
  const comp = new ICAL.Component(ICAL.parse(text));
  for (const tz of comp.getAllSubcomponents('vtimezone')) {
    try { ICAL.TimezoneService.register(tz); } catch (e) { /* ignore */ }
  }
  const masters = new Map();
  const standalone = [];
  const exceptions = [];
  for (const ve of comp.getAllSubcomponents('vevent')) {
    if (ve.hasProperty('recurrence-id')) exceptions.push(ve);
    else masters.set(ve.getFirstPropertyValue('uid'), new ICAL.Event(ve));
  }
  for (const ex of exceptions) {
    const m = masters.get(ex.getFirstPropertyValue('uid'));
    if (m) { try { m.relateException(ex); } catch (e) { standalone.push(new ICAL.Event(ex)); } }
    else standalone.push(new ICAL.Event(ex));
  }

  const out = [];
  const push = (item, startDate, endDate) => {
    if (!startDate || startDate.isDate) return; // skip all-day
    const c = item.component;
    if ((c.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED') return;
    if (email) {
      for (const a of c.getAllProperties('attendee')) {
        const v = String(a.getFirstValue() || '').toLowerCase();
        if (v === `mailto:${email}` && String(a.getParameter('partstat') || '').toUpperCase() === 'DECLINED') return;
      }
    }
    const blob = [c.getFirstPropertyValue('x-google-conference'), c.getFirstPropertyValue('location'), c.getFirstPropertyValue('description')]
      .filter(Boolean).join(' ');
    const m = blob.match(MEET_CODE_RE);
    if (!m) return;
    const start = startDate.toJSDate().getTime();
    if (start < winStart || start > winEnd) return;
    out.push({
      key: `${item.uid}|${start}`,
      title: item.summary || '(no title)',
      start,
      end: endDate ? endDate.toJSDate().getTime() : start + 30 * 60000,
      code: m[1].toLowerCase()
    });
  };

  for (const ev of [...masters.values(), ...standalone]) {
    if (ev.isRecurring()) {
      const it = ev.iterator();
      let next, n = 0;
      while ((next = it.next()) && n++ < 20000) {
        const ms = next.toJSDate().getTime();
        if (ms > winEnd) break;
        if (ms < winStart) continue;
        const d = ev.getOccurrenceDetails(next);
        push(d.item, d.startDate, d.endDate);
      }
    } else {
      push(ev, ev.startDate, ev.endDate);
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

async function refreshCalendar(force = false) {
  const s = await settings();
  const { fetchedAt = 0 } = await get('fetchedAt');
  if (!s.icalUrl) { await set({ events: [], fetchError: '' }); return; }
  if (!force && Date.now() - fetchedAt < CAL_REFRESH_MS) return;
  try {
    const now = Date.now();
    let events;
    if (/script\.google(usercontent)?\.com/.test(s.icalUrl)) {
      // Apps Script web app: returns ready-made JSON, recurring events already expanded.
      // No cookies: Apps Script answers with "Access-Control-Allow-Origin: *", which browsers
      // refuse for credentialed requests. An "Anyone" feed works directly; an org-only feed falls back to a tab.
      let data = null;
      try {
        const res = await fetch(s.icalUrl, { cache: 'no-store', credentials: 'omit', redirect: 'follow' });
        if (res.ok) data = JSON.parse(await res.text());
      } catch (e) { data = null; } // sign-in redirect, CORS or non-JSON answer
      if (!data) {
        // Feed limited to the organization: it needs the Google sign-in, which a background
        // request cannot send. Load it in a short-lived tab instead (feed.js reads the result).
        await loadFeedInTab(s.icalUrl);
        return;
      }
      if (data.error) throw new Error(data.error);
      events = filterFeed(data, now);
    } else {
      const res = await fetch(s.icalUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      events = parseIcs(await res.text(), calendarEmail(s.icalUrl), now - 2 * 3600000, now + 24 * 3600000);
    }
    await set({ events, fetchedAt: now, fetchError: '' });
    await log(`Calendar loaded: ${events.length} Meet meeting(s) in the next 24h`);
  } catch (e) {
    await set({ fetchError: `Could not load the calendar: ${e.message}`, fetchedAt: Date.now() });
    await log(`Calendar error: ${e.message}`);
  }
}

function filterFeed(data, now) {
  return (data.events || []).filter(e => e.start >= now - 2 * 3600000 && e.start <= now + 24 * 3600000);
}

async function loadFeedInTab(url) {
  const { feedTab } = await get('feedTab');
  if (feedTab && Date.now() - feedTab.at < 30000) return; // one already loading
  if (feedTab) { try { await chrome.tabs.remove(feedTab.tabId); } catch (e) { /* gone */ } }
  let tabId;
  try {
    const tab = await chrome.tabs.create({ url, active: false, index: 9999 });
    tabId = tab.id;
  } catch (e) {
    const win = await chrome.windows.create({ url, state: 'minimized' });
    tabId = win.tabs[0].id;
  }
  try { await chrome.tabs.update(tabId, { muted: true }); } catch (e) { /* ignore */ }
  await set({ feedTab: { tabId, at: Date.now() } });
}

async function feedArrived(tabId, text) {
  const { feedTab } = await get('feedTab');
  if (!feedTab || feedTab.tabId !== tabId) return false;
  await set({ feedTab: null });
  try { await chrome.tabs.remove(tabId); } catch (e) { /* gone */ }
  let data = null;
  try { data = JSON.parse(text); } catch (e) { /* not JSON */ }
  if (!data) {
    await set({ fetchError: 'Could not load the calendar: the feed page did not return data (are you signed in to Google with the account that owns the feed?)', fetchedAt: Date.now() });
    await log(`Calendar error (tab): ${text.slice(0, 200)}`);
  } else if (data.error) {
    await set({ fetchError: `Could not load the calendar: ${data.error}`, fetchedAt: Date.now() });
    await log(`Calendar error: ${data.error}`);
  } else {
    const events = filterFeed(data, Date.now());
    await set({ events, fetchedAt: Date.now(), fetchError: '' });
    await log(`Calendar loaded via tab: ${events.length} Meet meeting(s) in the next 24h`);
    await tick();
  }
  return true;
}

// ---------- watching ----------
async function openWatchTab(url) {
  try {
    const tab = await chrome.tabs.create({ url, active: false, pinned: true });
    return tab.id;
  } catch (e) {
    const win = await chrome.windows.create({ url, state: 'minimized' });
    return win.tabs[0].id;
  }
}

async function startWatch(key, ev, manual = false) {
  const s = await settings();
  const tabId = await openWatchTab(meetUrl(ev.code, s.authuser, true));
  try { await chrome.tabs.update(tabId, { muted: true, autoDiscardable: false }); } catch (e) { /* ignore */ }
  const watches = await bag('watches');
  watches[key] = {
    tabId, code: ev.code, title: ev.title, manual, loadedAt: Date.now(),
    until: manual ? Date.now() + MANUAL_WATCH_MS : ev.start + s.lateMin * 60000
  };
  await set({ watches });
  await log(`Watch started: ${ev.title} (${ev.code}), tab ${tabId}`);
}

async function stopWatch(key, markHandled = true, reason = '') {
  const watches = await bag('watches');
  const w = watches[key];
  if (!w) return;
  await log(`Watch stopped: ${w.title}${reason ? ' (' + reason + ')' : ''}`);
  delete watches[key];
  await set({ watches });
  if (markHandled) await markDone(key);
  try { await chrome.tabs.remove(w.tabId); } catch (e) { /* already closed */ }
}

async function markDone(key) {
  const handled = await bag('handled');
  handled[key] = Date.now();
  for (const k of Object.keys(handled)) if (Date.now() - handled[k] > 2 * 86400000) delete handled[k];
  await set({ handled });
}

async function tick() {
  await refreshCalendar();
  const s = await settings();
  const { events = [] } = await get('events');
  const handled = await bag('handled');
  const watches = await bag('watches');
  const now = Date.now();

  const { feedTab } = await get('feedTab');
  if (feedTab && now - feedTab.at > 45000) {
    try { await chrome.tabs.remove(feedTab.tabId); } catch (e) { /* gone */ }
    await set({ feedTab: null, fetchError: 'Could not load the calendar: the feed tab timed out' });
    await log('Calendar error: feed tab timed out');
  }
  let reloaded = false;
  for (const [key, w] of Object.entries(watches)) {
    if (now > w.until) { await stopWatch(key, true, 'watch window ended'); continue; }
    // Browsers slow down timers in tabs hidden for more than 5 minutes; a fresh load resets that.
    if (now - (w.loadedAt || 0) > 4 * 60000) {
      try { await chrome.tabs.reload(w.tabId); w.loadedAt = now; reloaded = true; await log(`Watch tab refreshed: ${w.title}`); }
      catch (e) { /* tab gone, onRemoved handles it */ }
    }
  }
  if (reloaded) await set({ watches });
  for (const [key, w] of Object.entries(await bag('watches'))) {
    if (now > w.until) await stopWatch(key, true, 'watch window ended');
  }
  for (const ev of events) {
    if (handled[ev.key] || watches[ev.key]) continue;
    if (now >= ev.start - s.leadMin * 60000 && now <= ev.start + s.lateMin * 60000) {
      await startWatch(ev.key, ev);
    }
  }
}

// ---------- ringing ----------
async function ensureOffscreen() {
  const ctx = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (ctx.length) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'], justification: 'Ring when someone joins a meeting'
  });
}

async function ringWindowPosition(w, h) {
  try {
    const displays = await chrome.system.display.getInfo();
    const d = displays.find(x => x.isPrimary) || displays[0];
    const a = d.workArea;
    return { left: a.left + a.width - w - 16, top: a.top + a.height - h - 16 };
  } catch (e) { return {}; }
}

async function ring(key, info) {
  const s = await settings();
  const ringing = await bag('ringing');
  if (ringing[key]) return;

  await ensureOffscreen();
  chrome.runtime.sendMessage({ target: 'offscreen', type: 'start', seconds: s.ringSec });

  const width = 380, height = 230;
  const win = await chrome.windows.create({
    url: `ring.html?key=${encodeURIComponent(key)}`, type: 'popup', width, height, focused: true,
    ...(await ringWindowPosition(width, height))
  });

  const notifId = `mr:${key}`;
  chrome.notifications.create(notifId, {
    type: 'basic', iconUrl: 'icon128.png', requireInteraction: true, priority: 2,
    title: `${info.who} joined`, message: info.title,
    buttons: [{ title: 'Join' }, { title: 'Dismiss' }]
  });

  ringing[key] = { ...info, at: Date.now(), ringSec: s.ringSec, windowId: win.id, notifId };
  await set({ ringing });
}

async function finishRing(key, join) {
  chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop' });
  const ringing = await bag('ringing');
  const r = ringing[key];
  if (!r) return;
  delete ringing[key];
  await set({ ringing });
  chrome.notifications.clear(r.notifId);
  try { await chrome.windows.remove(r.windowId); } catch (e) { /* closed */ }
  if (join && r.code) {
    const s = await settings();
    const url = meetUrl(r.code, s.authuser, false);
    let how = s.joinIn === 'window' ? 'separate window' : 'new tab';
    if (s.joinIn === 'helper') {
      const res = await helper({ url, launcher: s.launcher });
      if (res.ok) { await log(`Joined: ${r.title} (Meet app)`); return; }
      await log(`Meet app helper failed (${res.error}); opening a tab instead`);
      how = 'new tab, helper failed';
    }
    if (s.joinIn === 'window') {
      await chrome.windows.create({ url, type: 'popup', width: 1280, height: 800, focused: true });
    } else {
      const tab = await chrome.tabs.create({ url, active: true });
      try { await chrome.windows.update(tab.windowId, { focused: true }); } catch (e) { /* ignore */ }
    }
    await log(`Joined: ${r.title} (${how})`);
  }
}

// ---------- Meet app helper (Windows native messaging host) ----------
function helper(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(HELPER, msg, (res) => {
        if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
        else resolve(res || { ok: false, error: 'no answer from the helper' });
      });
    } catch (e) { resolve({ ok: false, error: e.message }); }
  });
}

// ---------- events ----------
chrome.runtime.onInstalled.addListener(() => chrome.alarms.create('tick', { periodInMinutes: 0.5 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create('tick', { periodInMinutes: 0.5 }));
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'tick') tick(); });

chrome.notifications.onButtonClicked.addListener((id, idx) => {
  if (id.startsWith('mr:')) finishRing(id.slice(3), idx === 0);
});
chrome.notifications.onClicked.addListener(id => { if (id.startsWith('mr:')) finishRing(id.slice(3), true); });

chrome.windows.onRemoved.addListener(async (windowId) => {
  const ringing = await bag('ringing');
  for (const [key, r] of Object.entries(ringing)) if (r.windowId === windowId) await finishRing(key, false);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { feedTab } = await get('feedTab');
  if (feedTab && feedTab.tabId === tabId) await set({ feedTab: null });
  const watches = await bag('watches');
  for (const [key, w] of Object.entries(watches)) {
    if (w.tabId === tabId) { delete watches[key]; await set({ watches }); await markDone(key); await log(`Watch tab closed: ${w.title}`); }
  }
});

// If the user opens the same meeting themselves, stop watching it.
chrome.tabs.onUpdated.addListener(async (tabId, change) => {
  if (!change.url || change.url.includes('meetringer-watch')) return;
  const m = change.url.match(MEET_CODE_RE);
  if (!m) return;
  const watches = await bag('watches');
  for (const [key, w] of Object.entries(watches)) {
    if (w.code === m[1].toLowerCase() && w.tabId !== tabId) await stopWatch(key, true, 'you opened the meeting yourself');
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target === 'offscreen') return;
  (async () => {
    const tabId = sender.tab && sender.tab.id;
    switch (msg.type) {
      case 'amIFeed': {
        const { feedTab } = await get('feedTab');
        return { feed: !!(feedTab && feedTab.tabId === tabId) };
      }
      case 'feedText': await feedArrived(tabId, msg.text || ''); return {};
      case 'amIWatch': {
        const watches = await bag('watches');
        const watch = Object.values(watches).some(w => w.tabId === tabId);
        if (watch || msg.last) await log(`Meet page ${watch ? 'attached as watch tab' : 'is not a watch tab'} (tab ${tabId}, ${msg.visibility})`);
        return { watch };
      }
      case 'presence': {
        const watches = await bag('watches');
        const entry = Object.entries(watches).find(([, w]) => w.tabId === tabId);
        if (!entry) return {};
        const [key, w] = entry;
        await log(`Detected: "${msg.line}"`);
        await ring(key, { who: msg.who, title: w.title, code: w.code });
        await stopWatch(key, true, 'someone joined');
        return {};
      }
      case 'snapshot':
        await set({ lastSnapshot: { text: msg.text, at: Date.now() } });
        await log(`Page text (tab ${tabId}): ${msg.text.slice(0, 300)}`);
        return {};
      case 'join': await finishRing(msg.key, true); return {};
      case 'joinedByLink': await log('Joined via link (opens in the Meet app if it captures Meet links)'); await finishRing(msg.key, false); return {};
      case 'dismiss': await finishRing(msg.key, false); return {};
      case 'refresh': await set({ fetchedAt: 0 }); await refreshCalendar(true); await tick(); return {};
      case 'saveSettings':
        await set({ settings: { ...(await settings()), ...msg.settings }, fetchedAt: 0 });
        await refreshCalendar(true); await tick();
        return {};
      case 'watchCurrent': {
        const m = (msg.url || '').match(MEET_CODE_RE);
        if (!m) return { error: 'This is not a Meet link.' };
        const code = m[1].toLowerCase();
        await startWatch(`manual:${code}:${Date.now()}`, { code, title: msg.title || code }, true);
        return {};
      }
      case 'stopWatch': await stopWatch(msg.key, true, 'stopped by hand'); return {};
      case 'checkHelper': return helper({ ping: true });
      case 'clearLog': await set({ log: [] }); return {};
      case 'testRing':
        await ring(`test:${Date.now()}`, { who: 'Test Person', title: 'Test meeting', code: null });
        return {};
      default: return {};
    }
  })().then(sendResponse);
  return true;
});
