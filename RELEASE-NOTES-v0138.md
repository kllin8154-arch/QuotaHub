# Agnovexa One 0.13.8 — DeepSeek official-page sampling regression fix

## What was fixed

DeepSeek's official usage page remained logged in and visibly showed rechargeable balance and granted balance, but the Windows client started reporting an authorization problem after the 0.13.7 quota-window extractor update.

Root cause: a regular expression embedded in the Electron visible-text sampler had lost its required backslash escaping. Currency-only lines such as `¥1.88 CNY` and `¥6.40 CNY` disappeared from the extracted text, so no verified balance could be produced. The fallback error contained login wording and was incorrectly presented as an expired session.

Fixes:
- Restored correct escaped patterns and added a regression that actually executes the browser-side extraction script against a representative DeepSeek usage page, then verifies **¥1.88 + ¥6.40 = ¥8.28**.
- Tested the full authorized-page path: 8.28 -> 8.27 -> an unavailable DOM sample -> 8.26, using the same account session and preserving real history.
- Errors due to missing balance on a loaded page are now distinguished from genuine 401/403 authorization failures; no raw error details or credentials are shown.
- Already web-connected DeepSeek accounts prioritize official-page monitoring; API Key connection is optional under advanced settings. Account editor offers a direct **重新检测余额** action.
- No change to cookies, API keys, Google OAuth, saved account credentials, quota history, or the ChatGPT separate 5-hour/weekly allowance parser.

## Verification

TypeScript/Vite build, source-extractor and official-page end-to-end tests, connection UX, Google sign-in, account linking, quota refresh, ChatGPT windows, alerts, and retry tests. A native Windows EXE is checked in an isolated D: data directory before safely activating production.

## Limitations

The program uses periodic authorized-page sampling, not official push notifications. An authenticated site redesign can still require a parser update. Windows portable builds are currently unsigned.
