#!/bin/zsh
# Copies ringtones from apps installed on this Mac into ./sounds for the Meet Ringer ringtone picker.
set -u
cd "$(dirname "$0")"
S=sounds; mkdir -p "$S"
R="/System/Library/PrivateFrameworks/ToneLibrary.framework/Versions/A/Resources/Ringtones"
T="/Applications/Microsoft Teams.app/Contents/Resources"
SL=""; for d in "/Applications/Slack.app" "$HOME/Applications/Slack.app"; do [[ -d "$d" ]] && SL="$d/Contents/Resources"; done
conv() { if [[ -f "$1" ]]; then afconvert -f m4af -d aac "$1" "$S/$2.m4a" && echo "added $2"; else echo "skipped $2 (not found)"; fi }
conv "$R/Reflection.m4r" iphone-reflection
conv "$R/Opening.m4r" iphone-opening
conv "$R/Marimba.m4r" iphone-marimba
conv "$R/Radar.m4r" iphone-radar
conv "$R/Old Phone.m4r" iphone-oldphone
conv "$T/b3_teams_urgent_notification_r4_escalate.wav" teams-escalate
conv "$T/b2_teams_urgent_notification_r4_prioritize.wav" teams-prioritize
conv "$T/b4_teams_urgent_notification_r4_alarm.wav" teams-alarm
conv "$T/00_teams_basic_notification_r4_default.wav" teams-default
if [[ -n "$SL" ]]; then
  conv "$SL/calls_incoming_ring_v2.mp3" slack-huddle-ring
  conv "$SL/knock_brush.mp3" slack-knock-brush
  conv "$SL/hummus.mp3" slack-hummus
  conv "$SL/here_you_go_lighter.mp3" slack-here-you-go
  conv "$SL/calls_they_joined_call_v2.mp3" slack-they-joined
  conv "$SL/boop.mp3" slack-boop
  conv "$SL/calls_alert_v2.mp3" slack-calls-alert
  conv "$SL/save_and_checkout.mp3" slack-save-and-checkout
else
  echo "skipped Slack sounds (Slack.app not found)"
fi
# Rewrite sounds/index.txt from every audio file in the folder ("file|label|gap").
# Your own files dropped into sounds/ are listed too, named after the file.
typeset -A LABEL GAP
LABEL=(iphone-reflection "iPhone - Reflection" iphone-opening "iPhone - Opening" iphone-marimba "iPhone - Marimba"
  iphone-radar "iPhone - Radar" iphone-oldphone "iPhone - Old Phone" teams-escalate "Teams - Urgent (escalate)"
  teams-prioritize "Teams - Urgent (prioritize)" teams-alarm "Teams - Alarm" teams-default "Teams - Default notification"
  slack-huddle-ring "Slack - Huddle / call ring" slack-knock-brush "Slack - Knock Brush" slack-hummus "Slack - Hummus"
  slack-here-you-go "Slack - Here You Go" slack-they-joined "Slack - Someone joined"
  slack-boop "Slack - Boop" slack-calls-alert "Slack - Calls Alert" slack-save-and-checkout "Slack - Save & Checkout")
GAP=(iphone-reflection 0 iphone-opening 0 iphone-marimba 0 iphone-radar 0 iphone-oldphone 0 slack-huddle-ring 0.3)
: > "$S/index.txt"
for f in "$S"/*.(wav|mp3|m4a|ogg|aac|flac)(N); do
  n="${f:t}"; b="${n:r}"
  echo "$n|${LABEL[$b]:-$b}|${GAP[$b]:-0.8}" >> "$S/index.txt"
done
echo "Done. In the Meet Ringer popup click Refresh next to Ringtone."
