$ErrorActionPreference = 'Stop'
function Reply($o) {
  $j = [Text.Encoding]::UTF8.GetBytes(($o | ConvertTo-Json -Compress))
  $out = [Console]::OpenStandardOutput()
  $out.Write([BitConverter]::GetBytes($j.Length), 0, 4)
  $out.Write($j, 0, $j.Length)
  $out.Flush()
}
try {
  $in = [Console]::OpenStandardInput()
  $lb = New-Object byte[] 4; $r = 0
  while ($r -lt 4) { $n = $in.Read($lb, $r, 4 - $r); if ($n -le 0) { exit }; $r += $n }
  $len = [BitConverter]::ToInt32($lb, 0)
  $buf = New-Object byte[] $len; $r = 0
  while ($r -lt $len) { $n = $in.Read($buf, $r, $len - $r); if ($n -le 0) { break }; $r += $n }
  $msg = [Text.Encoding]::UTF8.GetString($buf) | ConvertFrom-Json
  if ($msg.ping) { Reply @{ ok = $true; version = '1' }; exit }

  $url = [string]$msg.url
  if ($url -notmatch '^https://meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}(\?authuser=\d+)?$') { Reply @{ ok = $false; error = 'invalid meeting URL' }; exit }
  $cmd = [string]$msg.launcher
  if ($cmd -notmatch '^\s*"([^"]+)"(.*)$') { Reply @{ ok = $false; error = 'the shortcut target must start with a quoted program path' }; exit }
  $exe = $Matches[1]; $rest = $Matches[2]
  $name = [IO.Path]::GetFileName($exe).ToLower()
  $allowed = @('chrome_proxy.exe', 'chrome.exe', 'brave.exe', 'msedge.exe', 'msedge_proxy.exe')
  if (($allowed -notcontains $name) -or -not (Test-Path -LiteralPath $exe)) { Reply @{ ok = $false; error = "program not allowed or not found: $exe" }; exit }
  $a = @()
  if ($rest -match '--profile-directory=("[^"]+"|\S+)') { $a += '--profile-directory="' + $Matches[1].Trim('"') + '"' }
  if ($rest -match '--app-id=([a-p]{32})') { $a += '--app-id=' + $Matches[1] } else { Reply @{ ok = $false; error = 'no --app-id in the shortcut target' }; exit }
  $a += '--app-launch-url-for-shortcuts-menu-item=' + $url
  Start-Process -FilePath $exe -ArgumentList $a
  Reply @{ ok = $true }
} catch {
  Reply @{ ok = $false; error = $_.Exception.Message }
}
