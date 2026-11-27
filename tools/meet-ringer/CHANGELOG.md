# Meet Ringer changelog

| Version | Changes |
|---|---|
| 1.2.0 | Merged a colleague's customisations: ringtone picker with preview, Join turns mic and camera off and joins automatically (`join.js`, `#meetringer-join`), Decline / Later / Join with snooze, Rewatch and Watching / Handled / Snoozed status, optional *Keep watching after I leave*, restyled popup and call window, Google account field accepts an email. Fixes: organization-only feed goes straight to the feed tab, feed reader copes with JSON viewers, settings save reloads the calendar only when the URL changed, removed the blocked blob Worker. New: built-in ringtones (Classic, Chime, Old phone bell, Digital) that work on every computer; sounds folder read from `sounds/index.txt` with a Refresh button (list cached), filled by `add-sounds-mac.sh` (Mac) or the new `add-sounds-windows.bat` (Windows ringtones, plus Slack sounds if Slack is installed, also from the Microsoft Store); Mac loader renamed to `add-sounds-mac.sh`; your own sound file; Join in all three modes (tab, window, Meet app helper) auto-joins; helper accepts the join marker and email accounts |
| 1.1.1 | Calendar feed token moved from the script code to a Script Property (`TOKEN`); a feed without a token now refuses every request. Generic error texts. First release on GitHub |
| 1.1.0 | Join can open the installed Meet app through an optional Windows helper (`native-helper`). Fixed extension ID (`iehofllenepiiaaljmbhmnlmblgjadfb`); upgrading from 1.0.x resets settings once |
| 1.0.5 | New setting "Join opens the meeting in": new tab (with app link capturing) or a separate window |
| 1.0.4 | Watch tabs keep rendering in the background, so detection works without switching to them; watch tabs reload every 4 minutes |
| 1.0.3 | Organization-only feeds read through a short-lived background tab |
| 1.0.2 | Calendar feed read without cookies (fixes the CORS error) |
| 1.0.1 | Diagnostics log in the popup; fixed watch tabs sometimes not being recognized |
| 1.0.0 | First release |
