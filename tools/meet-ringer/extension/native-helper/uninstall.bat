@echo off
rem Removes the Meet Ringer helper for the current Windows user.
for %%K in ("Google\Chrome" "BraveSoftware\Brave-Browser" "Microsoft\Edge") do (
  reg delete "HKCU\Software\%%~K\NativeMessagingHosts\com.meetringer.launcher" /f >nul 2>&1
)
rmdir /s /q "%LOCALAPPDATA%\MeetRinger" >nul 2>&1
echo Meet Ringer helper removed.
pause
