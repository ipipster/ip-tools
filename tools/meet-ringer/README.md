# Meet Ringer

Teams-style ringing for Google Meet. When someone joins one of your Meet meetings before you do, Meet Ringer rings for about 30 seconds, shows who joined, and keeps a call window on screen with **Join** and **Dismiss** until you click one.

Google Meet itself does not ring for scheduled meetings: it only shows a short calendar notification that disappears after a few seconds.

**Full guide** (setup details, internals, design decisions): [docs/GUIDE.md](docs/GUIDE.md)

## How it works in one paragraph

A few minutes before each meeting with a Meet link, the extension opens the meeting's pre-join screen in a pinned, muted background tab (camera and mic blocked, it never joins). When that screen shows someone inside ("X is in this call"), it rings, opens a small call window in the bottom-right corner and shows a system notification. Any open Meet link can also be watched by hand, without calendar access.

Works in Google Chrome, Brave and other Chromium browsers with Manifest V3.

## Install (about 15 minutes, once)

### 1. Deploy your own calendar feed (Google Apps Script)

Every user deploys their **own** copy. Never reuse someone else's feed URL: a feed returns its owner's meetings.

1. Go to [script.google.com](https://script.google.com) > **New project**, delete the sample code and paste [`extension/calendar-feed.gs`](extension/calendar-feed.gs).
2. Enable the **Google Calendar API** advanced service (**Services +**). If the dialog does not open: Project Settings > tick *Show "appsscript.json" manifest file*, then add to `appsscript.json` (keep your own `timeZone`):
   ```json
   "dependencies": {
     "enabledAdvancedServices": [
       { "userSymbol": "Calendar", "serviceId": "calendar", "version": "v3" }
     ]
   }
   ```
3. **Project Settings > Script Properties > Add script property**: `TOKEN` = a long random string. The token stays out of the code.
4. **Deploy > New deployment > Web app**. Execute as: **Me**. Who has access: **Anyone** if offered, otherwise **Anyone within your organization**.
5. Authorize the calendar access, copy the Web app URL and append `?token=<your token>`. This is your **Calendar feed URL**.

Check it by opening the URL in the browser: it should return `{"events":[...]}`. After editing the script use **Deploy > Manage deployments > Edit > New version** so the same URL serves the new code.

### 2. Install the extension

1. Download `meet-ringer-<version>.zip` from [Releases](https://github.com/ipipster/ip-tools/releases) and unzip it to a **permanent** folder (the browser loads the extension from there).
2. Open `chrome://extensions` (Brave: `brave://extensions`) and turn on **Developer mode**. If the switch is greyed out, browser policy blocks unpacked extensions.
3. **Load unpacked** > select the `meet-ringer` folder (the one that directly contains `manifest.json`).
4. Pin the extension, open its popup, paste the Calendar feed URL and click **Save**. Upcoming meetings appear in the popup.

**Update:** unzip the new version over the same folder and click the reload button on Meet Ringer in `chrome://extensions`. Settings are kept.

### 3. Test

1. Popup > **Test ring**: two-tone ring, call window "Test Person joined", system notification. **Dismiss** stops it.
2. Open [meet.new](https://meet.new) without joining, click **Watch this meeting** in the popup, close your own Meet tab (keep the pinned one), and ask a colleague in your organization to join. External guests wait in the lobby and do not trigger the ring. A meeting you join yourself never rings, by design.

## Daily use

- Keep the browser running; every Meet meeting on your primary calendar is watched automatically.
- **Join** opens the meeting with camera and mic working; **Dismiss** silences it. The window stays until you click.
- A pinned, muted Meet tab around meeting start is the watch tab. Do not join from it; closing it stops watching.
- With an organization-only feed, a tab briefly appears at the end of the tab strip every 10 minutes while the calendar is read. This is expected.
- Opening the same meeting yourself stops the watch.

## Settings (toolbar popup)

| Setting | Default | What it does |
|---|---|---|
| Calendar feed URL | empty | Apps Script URL with `?token=...` (or a secret iCal address where allowed). Empty = manual mode only |
| Start before (min) | 3 | When the watch tab opens before the start |
| Keep after (min) | 15 | How long watching continues after the start |
| Ring (sec) | 30 | Ring length |
| Join opens the meeting in | new tab | New tab, the installed Meet app (Windows helper), or a separate window |
| Google account index | empty | Only if several Google accounts share one browser profile |

### Optional: open Join in the installed Meet app (Windows)

1. Double-click `native-helper\install.bat` (no admin rights; installs to `%LOCALAPPDATA%\MeetRinger` and registers for Chrome, Brave and Edge).
2. Right-click the Meet app shortcut > **Properties** and copy the whole **Target** field.
3. In the popup choose *The installed Meet app*, paste the Target, **Save**, then **Check helper**.

Remove it with `native-helper\uninstall.bat`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Could not load the calendar" | Open the feed URL in the browser and read the error. `TOKEN script property is not set` means step 1.3 is missing; after script edits deploy a new version |
| Someone is inside but nothing rings | Popup > Diagnostics log > **Copy log**; the page text shows what to add to the patterns in `content.js` (non-English Meet UI) |
| Ring comes late | Turn off the browser's energy saver |
| Call window but no system notification | Allow browser notifications in the OS and turn off Do Not Disturb / Focus |
| Load unpacked greyed out | Browser policy blocks unpacked extensions |

Limitations: the browser must be running; detection reads Meet's screen text, so a Meet UI change can need a pattern update; only meetings on the primary calendar are watched automatically.

## Security and privacy

- The Apps Script runs as you and returns only title, start, end and Meet code for the next 24 hours. **The feed URL contains your token: treat it like a password.** To revoke, change the `TOKEN` script property or delete the deployment.
- The extension sends nothing to third parties. Data and settings stay in the browser's local extension storage.
- Watch tabs never join a meeting and cannot use the camera or mic.
- The Windows helper only accepts messages from this extension (fixed extension ID), only opens `https://meet.google.com/<code>` links, and only through `chrome`, `chrome_proxy`, `brave`, `msedge` or `msedge_proxy`. `meetringer-host.bat` runs [`host.ps1`](extension/native-helper/host.ps1) base64-encoded so the PowerShell execution policy does not block it; CI checks on every change that the encoded code is exactly `host.ps1`.
- The `key` in `manifest.json` is a **public** key that fixes the extension ID. The matching private key is never committed.

## For developers

No build step: plain JavaScript loaded unpacked.

| File | Role |
|---|---|
| `manifest.json` | Permissions, content scripts, service worker |
| `background.js` | Calendar refresh, scheduling, watch tabs, ringing, Join/Dismiss, diagnostics log |
| `block-media.js` | In watch tabs: blocks camera/mic, keeps Meet rendering in the background |
| `content.js` | Reads the pre-join screen (`PRESENT_PATTERNS`, `EMPTY_PATTERNS`) |
| `feed.js` | Reads an organization-only feed from the short-lived feed tab |
| `offscreen.*` | Plays the ring (Web Audio) |
| `ring.*` | The call window |
| `popup.*` | Toolbar popup |
| `calendar-feed.gs` | Apps Script calendar feed |
| `lib/ical.js` | [ical.js](https://github.com/kewisch/ical.js) 2.1.0 (MPL-2.0), for the iCal feed option |
| `native-helper/` | Optional Windows native messaging helper |

After editing `native-helper/host.ps1`, regenerate the .bat: `python scripts/meet_ringer_helper.py --write`.

Release: bump `version` in `manifest.json`, add a line to [CHANGELOG.md](CHANGELOG.md), merge, then push the tag `meet-ringer-v<version>`.
