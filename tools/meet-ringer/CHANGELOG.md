# Meet Ringer changelog

| Version | Changes |
|---|---|
| 1.1.1 | Calendar feed token moved from the script code to a Script Property (`TOKEN`); a feed without a token now refuses every request. Generic error texts. First release on GitHub |
| 1.1.0 | Join can open the installed Meet app through an optional Windows helper (`native-helper`). Fixed extension ID (`iehofllenepiiaaljmbhmnlmblgjadfb`); upgrading from 1.0.x resets settings once |
| 1.0.5 | New setting "Join opens the meeting in": new tab (with app link capturing) or a separate window |
| 1.0.4 | Watch tabs keep rendering in the background, so detection works without switching to them; watch tabs reload every 4 minutes |
| 1.0.3 | Organization-only feeds read through a short-lived background tab |
| 1.0.2 | Calendar feed read without cookies (fixes the CORS error) |
| 1.0.1 | Diagnostics log in the popup; fixed watch tabs sometimes not being recognized |
| 1.0.0 | First release |
