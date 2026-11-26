@echo off
setlocal
rem Installs the Meet Ringer helper for the current Windows user (no admin rights needed).
set "DIR=%LOCALAPPDATA%\MeetRinger"
if not exist "%DIR%" mkdir "%DIR%"
copy /y "%~dp0meetringer-host.bat" "%DIR%\" >nul
copy /y "%~dp0host.ps1" "%DIR%\" >nul
> "%DIR%\com.meetringer.launcher.json" (
  echo {
  echo   "name": "com.meetringer.launcher",
  echo   "description": "Meet Ringer helper - opens a meeting in the installed Google Meet app",
  echo   "path": "meetringer-host.bat",
  echo   "type": "stdio",
  echo   "allowed_origins": ["chrome-extension://iehofllenepiiaaljmbhmnlmblgjadfb/"]
  echo }
)
for %%K in ("Google\Chrome" "BraveSoftware\Brave-Browser" "Microsoft\Edge") do (
  reg add "HKCU\Software\%%~K\NativeMessagingHosts\com.meetringer.launcher" /ve /t REG_SZ /d "%DIR%\com.meetringer.launcher.json" /f >nul
)
echo Meet Ringer helper installed to %DIR%
echo In the extension popup, click "Check helper" to confirm.
pause
