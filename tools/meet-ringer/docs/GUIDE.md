# Meet Ringer - full guide

Teams-style ringing for Google Meet. This is the complete guide: background, setup, daily use, internals and design decisions. For the short version see the [README](../README.md).

- [Overview](#overview)
- [Get started](#get-started)
- [Daily use](#daily-use)
- [Settings](#settings)
- [Under the hood](#under-the-hood)
- [Alternatives considered](#alternatives-considered)
- [Troubleshooting and limitations](#troubleshooting-and-limitations)
- [Security and privacy](#security-and-privacy)

## Overview

### Problem

Google Meet does not ring when someone starts or joins a scheduled meeting. It only shows a short calendar notification with a single quiet sound, and the notification disappears after a few seconds. Microsoft Teams, in contrast, rings until you join or decline.

The goal: when someone joins one of your Meet meetings before you do, ring for about 30 seconds, show who joined, and keep a message on screen with **Join** and **Dismiss** buttons until you click one of them.

### Solution

Meet Ringer is a Chrome extension (Manifest V3) that watches the Meet pre-join screen and rings as soon as someone is in the call. The pre-join screen is the page you see after opening a Meet link but before clicking Join; it shows who is already inside (for example "Alex Smith is in this call").

- **Calendar-driven:** a few minutes before each meeting with a Meet link, the extension opens the meeting's pre-join screen in a pinned, muted background tab. It never joins the meeting.
- **Camera and mic stay off:** the background tab blocks camera and microphone access, so the camera light never turns on.
- **Ring:** when the pre-join screen shows someone inside, a two-tone ring plays for 30 seconds, a call window opens in the bottom-right corner, and a system notification appears. Both show who joined and offer Join and Dismiss.
- **Persistent message:** after the ring stops, the window stays on screen until Join or Dismiss is clicked.
- **Manual mode:** any open Meet link can be watched with one click, without calendar access.

Calendar data comes from a small Google Apps Script web app that runs under your own Google account (see [why](#alternatives-considered)).

Meet Ringer works in Google Chrome and Brave (any Chromium-based browser with Manifest V3 extensions).

## Get started

Three one-time steps (about 15 minutes), then daily use.

### Before you start

- Google Chrome or Brave.
- The browser signed in to the Google account whose calendar you want to watch.
- Browser policy that allows Developer mode (needed to load the extension).
- A colleague for two minutes, for the join test.

### Step 1: Deploy your calendar feed (Apps Script)

Every user deploys their **own** copy of this script and never reuses someone else's feed URL, because a feed returns its owner's meetings. The feed reads your primary calendar and returns the next 24 hours of Meet meetings as JSON. It expands recurring meetings, applies moved occurrences and drops declined or cancelled ones.

1. Go to [script.google.com](https://script.google.com), create a **New project**, delete the sample code and paste the contents of [`calendar-feed.gs`](../extension/calendar-feed.gs).
2. Enable the **Google Calendar API** (advanced service) via **Services +**. If the dialog does not open:
   1. Open **Project Settings** (gear icon) and tick **Show "appsscript.json" manifest file in editor**.
   2. Back in the Editor, open `appsscript.json` and add the block below, keeping your own `timeZone`:
      ```json
      "dependencies": {
        "enabledAdvancedServices": [
          { "userSymbol": "Calendar", "serviceId": "calendar", "version": "v3" }
        ]
      }
      ```
   3. Save. Calendar now appears under Services.
3. **Project Settings > Script Properties > Add script property:** Property `TOKEN`, Value: a long random string. The token stays out of the code, so the script can be shared without leaking it. Without it the feed refuses every request.
4. **Deploy > New deployment > Web app.** Execute as: **Me**. Who has access: **Anyone** if offered, otherwise **Anyone within your organization**.
   - An *Anyone* feed is read directly in the background.
   - An organization-only feed needs your Google sign-in, so the extension loads it in a background tab for a few seconds every 10 minutes; a tab briefly appearing at the end of the tab strip is expected.
5. Authorize the requested calendar access.
6. Copy the Web app URL and append `?token=<your token>`. This is the **Calendar feed URL** for the extension.

To check the feed, open the URL in the browser: it should return `{"events":[...]}`. A wrong token returns `{"error":"unauthorized (wrong token)"}`. After editing the script, use **Deploy > Manage deployments > Edit > New version** so the same URL serves the new code.

### Step 2: Install and configure the extension

1. Download `meet-ringer-<version>.zip` from [Releases](https://github.com/ipipster/ip-tools/releases) and unzip it to a **permanent** folder (Chrome loads the extension from that folder, so do not delete it).
2. Open `chrome://extensions` and turn on **Developer mode** (top right; in Brave the page is `brave://extensions`). If the switch is greyed out, browser policy blocks unpacked extensions and IT has to allow it.
3. Click **Load unpacked** and select the `meet-ringer` folder (the one that directly contains `manifest.json`).
4. Pin the extension to the toolbar. The yellow bell icon means it is loaded.
5. Open the popup, paste the Calendar feed URL, and click **Save**. Upcoming meetings appear under *Upcoming Meet meetings*.
6. Click **Test ring** to check the sound, the call window and the notification.

**To update:** unzip the new version over the same folder and click the reload button on Meet Ringer in `chrome://extensions`. Settings are kept.

### Step 3: Quick test

Two checks confirm the installation in about 5 minutes. A meeting you join yourself from the same browser never rings, by design, so the second check needs a colleague.

**1. Ring, window and notification**

1. Open the extension popup and click **Test ring**.
2. Expected: a two-tone ring for 30 seconds, a call window in the bottom-right corner showing "Test Person joined", and a system notification with Join and Dismiss.
3. Click **Dismiss**: the ring stops and the window closes.

**2. Join detection**

1. Open [meet.new](https://meet.new) to create a meeting, but do not join it.
2. In the popup, click **Watch this meeting**. The meeting appears under *Watching now* and a pinned, muted Meet tab opens.
3. Close your own Meet tab (keep the pinned one).
4. Send the meeting link to a colleague in your organization and ask them to join. External guests wait in the lobby until admitted, so they do not trigger the ring.
5. Expected: within a few seconds the ring starts and the call window shows the colleague's name. Click **Join** to enter the meeting with camera and mic working.

If the colleague is inside but nothing rings, open **Diagnostics log** in the popup, click **Copy log** and check it (see [Troubleshooting](#troubleshooting-and-limitations)).

## Daily use

Once the feed is set, nothing needs to be done day to day: keep the browser running and the extension watches every Meet meeting on the calendar.

- **When it rings:** click **Join** to open the meeting, or **Dismiss** to silence it. The ring stops after 30 seconds on its own, but the call window and notification stay until clicked. Clicking the notification body also joins.
- **Pinned Meet tabs:** a pinned, muted Meet tab around meeting start is the watch tab. Do not join from it (its camera and mic are blocked); closing it stops watching that meeting. You do not need to switch to it; it reloads itself every 4 minutes.
- **Watch a meeting by hand:** open the Meet link, click **Watch this meeting** in the popup, then close your own tab. Manual watches last 60 minutes.
- **Stop watching:** click the x next to the meeting under *Watching now*.
- **Joining yourself:** opening the same meeting in another tab stops the watch, so there is no ring for a meeting you are already in.

## Settings

All settings are in the toolbar popup and are saved in the extension's local storage.

| Setting | Default | What it does |
|---|---|---|
| Calendar feed URL | empty | Apps Script web app URL with `?token=...`, or a secret iCal address where allowed. Empty means manual mode only |
| Start before (min) | 3 | How many minutes before the start the watch tab opens |
| Keep after (min) | 15 | How many minutes after the start watching continues |
| Ring (sec) | 30 | How long the ring plays |
| Google account index (authuser) | empty | Only needed if several Google accounts are signed in to the same browser profile; 0 is the first account |

**Join opens the meeting in** decides where Join opens the meeting:

- **A new tab** (default): opens the meeting in a new browser tab with a normal link click. If your browser lets the installed Meet app capture Meet links (an "Open supported links" app setting, not available in Brave), it opens in the app instead.
- **The installed Meet app (Windows helper needed):** opens the meeting in the Google Meet app installed from the browser, even in Brave. It needs the small Windows helper from the package's `native-helper` folder:
  1. Double-click `native-helper\install.bat` (no admin rights needed; it installs to `%LOCALAPPDATA%\MeetRinger` and registers the helper for Chrome, Brave and Edge).
  2. Right-click the Meet app shortcut (taskbar or Start menu) > **Properties**, and copy the whole **Target** field, for example `"C:\Program Files\BraveSoftware\Brave-Browser\Application\chrome_proxy.exe" --profile-directory=Default --app-id=...`.
  3. In the popup, choose this option, paste the Target into *Meet app shortcut target*, click **Save**, then **Check helper**: it should say "Helper installed and working".

  If the helper fails when joining, the meeting opens in a new tab instead and the reason is in the diagnostics log. To remove the helper, run `native-helper\uninstall.bat`.
- **A separate window:** opens the meeting in its own window without tabs or address bar, much like the app, but grouped with the browser on the taskbar.

## Under the hood

### How it works

Every 30 seconds the extension checks the calendar and decides which meetings to watch.

1. The background service worker loads the next 24 hours of meetings from the calendar feed (refreshed every 10 minutes). If the feed is organization-only, reading it needs your Google sign-in, so the feed URL is opened for a few seconds in a background tab, read by `feed.js`, and the tab is closed. Cancelled meetings, declined meetings and all-day events are skipped; only events with a Meet link are kept.
2. From 3 minutes before start until 15 minutes after start, it opens the meeting at `https://meet.google.com/<code>#meetringer-watch` in a pinned, muted tab that the browser is not allowed to discard.
3. In that tab, `block-media.js` runs before Meet's own code and makes camera and microphone requests fail. It also makes the hidden tab report itself as visible and keeps Meet's screen updates running, because browsers pause page rendering in background tabs and the "in this call" text would otherwise only appear when you switch to the tab. The tab is reloaded every 4 minutes so the browser does not slow it down further. It only acts on URLs carrying the `#meetringer-watch` marker.
4. `content.js` reads the pre-join text on every page change and every 3 seconds, and looks for lines like "X is in this call" or "X and Y are in this call".
5. On a match, the service worker starts the ring (offscreen audio page), opens the call window, shows a notification, marks the meeting as handled and closes the watch tab.
6. **Join** opens the meeting in a new, normal tab with working camera and mic. **Dismiss**, or closing the call window, stops the ring and closes the message.

Watching also stops when the watch window ends, when the watch tab is closed by hand, or when you open the same meeting yourself in another tab (so it never rings once you are already handling the meeting).

### Files

| File | Role |
|---|---|
| `manifest.json` | Extension definition: permissions, content scripts, service worker |
| `background.js` | Service worker: calendar refresh, scheduling, watch tabs, ringing, Join/Dismiss, diagnostics log |
| `lib/ical.js` | [ical.js](https://github.com/kewisch/ical.js) 2.1.0 (Mozilla, MPL-2.0), used only for the iCal feed option |
| `block-media.js` | Runs in watch tabs before Meet's code: blocks camera and mic, reports the tab as visible and keeps Meet rendering in the background |
| `content.js` | Reads the pre-join screen and reports who is inside; sends page text to the diagnostics log |
| `feed.js` | Reads an organization-only calendar feed from the short-lived feed tab |
| `offscreen.html` / `offscreen.js` | Plays the two-tone ring with Web Audio |
| `ring.html` / `ring.js` | The bottom-right call window with Join and Dismiss |
| `popup.html` / `popup.js` | Toolbar popup: status, upcoming meetings, manual watch, settings, diagnostics log |
| `icon128.png` | Extension and notification icon |
| `calendar-feed.gs` | Google Apps Script web app that serves the calendar feed as JSON |
| `native-helper/` | Optional Windows native messaging helper that opens the installed Meet app |

### Build

There is no build step: the extension is plain JavaScript loaded unpacked. The release package is built by GitHub Actions when a `meet-ringer-v<version>` tag is pushed.

- **Calendar parser:** `npm pack ical.js@2.1.0`, unpack it, and copy `package/dist/ical.min.js` to `lib/ical.js`. It is an ES module with a default export, which is why the service worker is declared with `"type": "module"`.
- **Syntax check:** `node --check` on each script, and `node --input-type=module --check < background.js` for the service worker. CI runs these on every pull request.
- **Windows helper:** after editing `native-helper/host.ps1`, run `python scripts/meet_ringer_helper.py --write` to regenerate `meetringer-host.bat`.

After any change to the files, open `chrome://extensions` and click the reload button on Meet Ringer.

### Maintenance

- **Detection patterns:** `PRESENT_PATTERNS` (someone inside) and `EMPTY_PATTERNS` (no one inside) at the top of `content.js`.
- **Ring sound:** tone frequencies and rhythm in `offscreen.js`.
- **Timing:** watch window defaults in `DEFAULTS` in `background.js`; calendar refresh interval in `CAL_REFRESH_MS` (10 minutes).

## Alternatives considered

Before building Meet Ringer, these options were checked and rejected:

- **Native Google Meet:** no setting rings for scheduled meetings; only direct Meet calls ring.
- **Third-party ringers** (Meeting Ringer, Meeting Caller, MeetRinger): they ring at the calendar start time, not when someone joins, and give an outside vendor access to the work calendar.
- **Google Workspace Events API:** official "participant joined" events, but needs a Google Cloud project, Pub/Sub and admin approval.
- **Secret or public iCal address:** compared below.

### Secret iCal address vs Apps Script feed

The extension can also read a Google Calendar secret iCal address instead of the Apps Script feed. Many Workspace admins disable it, and the public address only returns events for a calendar made public, which a work calendar should never be.

Where the admin allows it, setup takes one step: Google Calendar > Settings > your calendar > **Integrate calendar** section > copy **Secret address in iCal format** (ends in `/basic.ics`) > paste it into the extension's Calendar feed URL field.

| | Apps Script feed (recommended) | Secret iCal address |
|---|---|---|
| Availability | Works wherever Apps Script is allowed | Often disabled by the Workspace admin |
| Setup effort | About 5 minutes: script, Calendar API, deployment | Copy and paste one URL |
| Freshness | Live: every refresh reads the calendar directly | Google refreshes the iCal file with a delay; new or moved meetings can appear hours later |
| Data exposed if the URL leaks | Title, start, end and Meet code for the next 24 hours | The whole calendar: all events, descriptions and attendees |
| Processing | Google expands recurring meetings and declines | The extension parses the full calendar file (ical.js) |
| Revoking access | Change the `TOKEN` script property or delete the deployment | Reset the secret address in calendar settings |

**Verdict:** the secret iCal address is simpler to set up, but the Apps Script feed is better: it picks up last-minute meetings immediately and exposes far less data. The iCal option stays for setups where Apps Script is blocked but the secret address is allowed.

## Troubleshooting and limitations

| Symptom | Likely cause | Fix |
|---|---|---|
| Popup shows "Could not load the calendar" | Wrong token, `TOKEN` script property missing, deployment not updated, or access not allowed | Open the feed URL in the browser and check the response; redeploy a new version after script edits |
| "The feed asks for a Google sign-in", or a CORS error in the extension console | Organization-only feed on extension 1.0.2 or older | Update to the latest version; stay signed in to the Google account that owns the feed |
| Rings only when you switch to the pinned watch tab | Extension 1.0.3 or older | Update to the latest version |
| Someone is in the meeting but nothing rings | Pre-join text not recognized (for example a non-English Meet UI) | Open Diagnostics log, click Copy log, and use the page text in it to extend the patterns in `content.js` |
| Ring comes late | Energy or battery saver slows background tabs further | Turn off energy saver for the browser; the diagnostics log shows when the page text was read |
| Load unpacked is greyed out | Browser policy blocks unpacked extensions | Ask IT to allow it |

If the call window appears but no system notification does, allow notifications for the browser in the operating system (Windows: Settings > System > Notifications; macOS: System Settings > Notifications) and check that Do Not Disturb or Focus is off. If the browser says the manifest is missing when loading the extension, select the folder that directly contains `manifest.json`, not the folder above it.

**Known limitations:**

- The browser must be running; there is no ring when it is closed. To keep it running with all windows closed, turn on *Continue running background apps* (Chrome: Settings > System; Brave: `brave://settings/system`).
- Detection reads Meet's screen text. If Google changes the pre-join page, the patterns in `content.js` need an update.
- English pre-join text is supported; the Hungarian patterns are best guesses until confirmed from Diagnostics.
- Only meetings on the primary calendar with a Meet link are watched automatically; others need manual mode. With an organization-only feed, the browser must stay signed in to the account that owns the feed.

## Security and privacy

- The Apps Script runs as you and only returns title, start, end and Meet code for the next 24 hours. The token in the URL keeps others out: **treat the feed URL like a password** and never share or commit it.
- The extension sends nothing to third parties. Calendar data and settings stay in the browser's local extension storage.
- Watch tabs never join a meeting and cannot use the camera or microphone.
- The optional Windows helper only accepts messages from the Meet Ringer extension (fixed extension ID). It only opens `https://meet.google.com/<code>` links, and only through a browser program named `chrome`, `chrome_proxy`, `brave`, `msedge` or `msedge_proxy`, keeping just the profile and app ID from the shortcut target. Its PowerShell source is in `native-helper/host.ps1`; `meetringer-host.bat` runs the same code base64-encoded, so PowerShell's script execution policy does not block it (stricter company controls still can). CI checks on every change that the encoded code is exactly `host.ps1`.
- The `key` in `manifest.json` is a public key that fixes the extension ID; the matching private key is never published.
