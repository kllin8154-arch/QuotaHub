# Agnovexa One v0.15.2 — full exit from compact widget and system tray

## Why
Previously the compact widget's context menu said “退出组件” and the Windows system tray said “彻底退出”, but each used Electron's ordinary `app.quit()` independently. Hidden authenticated browser sessions can intercept `close` to preserve login for normal window closing, leaving the impression that the app never quit. A stale `allowQuit` flag was written but never read.

## Fixed
- **Both** the compact widget context menu and the system tray now say **退出 Agnovexa One** and invoke a single idempotent `requestExit()` path. This is a full application exit, not hide/minimize/tray.
- Native **重新启动 Agnovexa One** stays a separate action. Only it schedules `app.relaunch()`. Normal **退出** never relaunches.
- The exit path first cancels in-progress Google auth, waits a bounded period for Chromium's authorized website session storage to flush, shuts down polling and hidden website windows, closes widget/dashboard windows, removes the tray icon, and finally uses `app.exit(0)` to guarantee termination.
- Internal `--quit-existing` uses the same path through the existing Electron single-instance listener, enabling safe verification and scripted quit/reopen without terminating unrelated processes.
- Existing close/minimize-to-tray behavior remains intact for controls not explicitly labeled “退出”. Persistent quota/account history and third-party permissions are unchanged.

## Verification
- Unit tests prove both menu callbacks share the same path, exit is idempotent, Chromium storage flush is awaited or safely time-bounded, quit never schedules a relaunch, and restart schedules exactly one.
- Packaged Windows EXE isolation: perform real native MenuItem clicks for widget and tray actions via QA-only flags in an isolated D: test profile; ensure zero residual application processes; request quit via single-instance IPC; ensure zero residual processes.
- Standard Electron isolated UI, Google OAuth, DeepSeek browser balance extraction, ChatGPT subscription window, local agent discovery, quota alerts and refresh regression suite.
- Production upgrade only after passing QA, backed up and verified with hashes; then explicit real production quit and relaunch, testing no old processes and authorized account restoration.

## Notes
- QA flags are only active with `AIQUOTA_QUIT_QA=1` and an isolated `.qa` data directory; never on normal launches.
- Windows portable EXE is not yet digitally signed; no extra dependencies.
