/**
 * Meet Ringer calendar feed (Google Apps Script).
 * Returns your Meet meetings for the next 24 hours as JSON for the Meet Ringer extension.
 *
 * Setup:
 * 1. script.google.com > New project, paste this file.
 * 2. Enable the Google Calendar API advanced service (Services + , or via appsscript.json).
 * 3. Project Settings (gear icon) > Script Properties > Add script property:
 *    Property: TOKEN, Value: a long random string. The token is kept out of the code,
 *    so this file can be shared or committed without leaking it.
 * 4. Deploy > New deployment > Web app.
 *    Execute as: Me. Who has access: Anyone if offered, otherwise Anyone within your organization.
 * 5. Authorize, copy the Web app URL, add ?token=YOUR_TOKEN to the end, paste it into Meet Ringer.
 */
function doGet(e) {
  const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token) return json({ error: 'TOKEN script property is not set (Project Settings > Script Properties)' });
  if (!e || !e.parameter || e.parameter.token !== token) return json({ error: 'unauthorized (wrong token)' });

  const now = Date.now();
  const res = Calendar.Events.list('primary', {
    timeMin: new Date(now - 2 * 3600000).toISOString(),
    timeMax: new Date(now + 24 * 3600000).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250
  });

  const events = (res.items || [])
    .filter(ev => ev.status !== 'cancelled' && ev.start && ev.start.dateTime)
    .filter(ev => !(ev.attendees || []).some(a => a.self && a.responseStatus === 'declined'))
    .map(ev => {
      const entry = ((ev.conferenceData && ev.conferenceData.entryPoints) || [])
        .map(p => p.uri).find(u => /meet\.google\.com/.test(u || ''));
      const link = ev.hangoutLink || entry || '';
      const m = link.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
      if (!m) return null;
      const start = Date.parse(ev.start.dateTime);
      return {
        key: ev.id + '|' + start,
        title: ev.summary || '(no title)',
        start: start,
        end: Date.parse(ev.end.dateTime),
        code: m[1].toLowerCase()
      };
    })
    .filter(Boolean);

  return json({ events: events });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
