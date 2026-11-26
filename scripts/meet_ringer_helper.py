"""Keeps native-helper/meetringer-host.bat in sync with host.ps1.

The .bat runs host.ps1 as a base64 -EncodedCommand so PowerShell's execution
policy does not block it. Encoded code is hard to review, so CI checks that it
decodes to exactly host.ps1.

  python scripts/meet_ringer_helper.py --check   # fail if out of sync (CI)
  python scripts/meet_ringer_helper.py --write   # regenerate the .bat after editing host.ps1
"""
import base64
import pathlib
import re
import sys

DIR = pathlib.Path(__file__).resolve().parent.parent / "tools/meet-ringer/extension/native-helper"
PS1 = DIR / "host.ps1"
BAT = DIR / "meetringer-host.bat"
PATTERN = re.compile(r"-EncodedCommand (\S+)")


def norm(text):
    return text.replace("\r\n", "\n").strip()


def encode(text):
    return base64.b64encode((norm(text) + "\n").encode("utf-16-le")).decode()


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "--check"
    ps1 = PS1.read_text(encoding="utf-8")
    bat = BAT.read_text(encoding="utf-8")
    m = PATTERN.search(bat)
    if not m:
        sys.exit("No -EncodedCommand found in meetringer-host.bat")
    if mode == "--write":
        BAT.write_text(bat.replace(m.group(1), encode(ps1)), encoding="utf-8", newline="\r\n")
        print("meetringer-host.bat regenerated from host.ps1")
        return
    decoded = base64.b64decode(m.group(1)).decode("utf-16-le")
    if norm(decoded) != norm(ps1):
        sys.exit("meetringer-host.bat does NOT match host.ps1. Run: python scripts/meet_ringer_helper.py --write")
    print("OK: meetringer-host.bat runs exactly host.ps1")


if __name__ == "__main__":
    main()
