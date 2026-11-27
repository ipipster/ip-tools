@echo off
setlocal
rem Meet Ringer: copies ringtones into .\sounds for the ringtone picker, then rewrites
rem sounds\index.txt from every audio file there. Your own files dropped into sounds\ are
rem listed too, named after the file. Afterwards click Refresh next to Ringtone in the popup.
rem  - Windows ringtones from C:\Windows\Media
rem  - Slack sounds, if the Slack desktop app (web installer or Microsoft Store) keeps them as separate files
cd /d "%~dp0"
if not exist sounds mkdir sounds

set "M=%WINDIR%\Media"
for %%F in ("%M%\Ring*.wav" "%M%\Alarm*.wav" "%M%\Windows Notify Calendar.wav" "%M%\Windows Ringin.wav") do (
  if exist "%%~F" copy /y "%%~F" sounds\ >nul && echo added %%~nxF
)

rem Slack: per-user install (%LOCALAPPDATA%\slack\app-x.y.z) or machine-wide (Program Files).
set "SL="
for %%R in ("%LOCALAPPDATA%\slack" "%ProgramFiles%\Slack" "%ProgramFiles(x86)%\Slack") do (
  if exist "%%~R" for /f "delims=" %%P in ('where /r "%%~R" calls_incoming_ring_v2.mp3 2^>nul') do set "SL=%%~dpP"
)
rem Slack from the Microsoft Store: its folder under C:\Program Files\WindowsApps cannot be
rem browsed, but Get-AppxPackage tells the exact path (no admin needed), and files there
rem are usually readable.
if not defined SL (
  for /f "delims=" %%A in ('powershell -NoProfile -NonInteractive -Command "(Get-AppxPackage -Name *Slack*).InstallLocation" 2^>nul') do (
    if exist "%%~A" for /f "delims=" %%P in ('where /r "%%~A" calls_incoming_ring_v2.mp3 2^>nul') do set "SL=%%~dpP"
  )
)
if defined SL (
  call :slack calls_incoming_ring_v2 slack-huddle-ring
  call :slack knock_brush slack-knock-brush
  call :slack hummus slack-hummus
  call :slack here_you_go_lighter slack-here-you-go
  call :slack calls_they_joined_call_v2 slack-they-joined
  call :slack boop slack-boop
  call :slack calls_alert_v2 slack-calls-alert
  call :slack save_and_checkout slack-save-and-checkout
) else (
  echo skipped Slack sounds: Slack is not installed, its folder is not readable, or it keeps its sounds inside the app package
)

> sounds\index.txt (
  for %%F in (sounds\*.wav sounds\*.mp3 sounds\*.m4a sounds\*.ogg) do call :entry "%%~nxF" "%%~nF"
)
echo.
echo Done. In the Meet Ringer popup click Refresh next to Ringtone.
pause
exit /b

:slack
if exist "%SL%%1.mp3" (copy /y "%SL%%1.mp3" "sounds\%2.mp3" >nul && echo added %2) else (echo skipped %2 - not found)
exit /b

:entry
rem Writes one "file|label|gap" line with a friendly label for known sounds.
rem Delayed expansion keeps labels with "&" (Save & Checkout) from breaking the echo.
setlocal EnableDelayedExpansion
set "N=%~2"
set "L=%~2"
set "G=0.8"
if /i "%N:~0,4%"=="Ring" set "L=Windows - %N%"
if /i "%N:~0,5%"=="Alarm" set "L=Windows - %N%"
if /i "%N:~0,8%"=="Windows " set "L=%N%"
if /i "%N%"=="slack-huddle-ring" (set "L=Slack - Huddle / call ring" & set "G=0.3")
if /i "%N%"=="slack-knock-brush" set "L=Slack - Knock Brush"
if /i "%N%"=="slack-hummus" set "L=Slack - Hummus"
if /i "%N%"=="slack-here-you-go" set "L=Slack - Here You Go"
if /i "%N%"=="slack-they-joined" set "L=Slack - Someone joined"
if /i "%N%"=="slack-boop" set "L=Slack - Boop"
if /i "%N%"=="slack-calls-alert" set "L=Slack - Calls Alert"
if /i "%N%"=="slack-save-and-checkout" set "L=Slack - Save & Checkout"
echo(%~1^|!L!^|!G!
endlocal
exit /b
