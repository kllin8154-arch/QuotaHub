# Agnovexa One 0.14.1 — verified balances and simpler authorized-account editing

## Changes
- The overview **最近有效额度** counter now counts only authorized, healthy samples from the last five minutes; manually entered values and stale samples are excluded.
- Dashboard card and account details label previous successfully collected amounts as **上次有效记录** whenever a connection is delayed/errored. Such values are still retained for history, not treated as live.
- Percentage-native official quota signals can now trigger per-account alerts without a manually entered budget. Direct remaining percentage at/below a threshold and used percentage at/above a threshold are evaluated against fresh, authorized samples only. Independent five-hour/weekly ChatGPT allowances are checked individually with each observation's timestamp. CNY, USD, and token amounts still require a trustworthy reference limit.
- Existing connected accounts now open a compact editor: account name, current authorization health and **检测额度**. Advanced value, threshold, API key, and monitoring controls remain accessible behind **展开高级设置**. New and unconnected accounts preserve their full onboarding fields.
- Diagnostics for periodically monitored accounts now explain that a recoverable failure preserves the most recent successful sample and that the existing **per-account backoff retry** will continue. Genuine expired-login errors are still distinguished and are not called self-recoverable.
- Does not change the browser session, API key storage, Google OAuth scope, account IDs, historical samples, or the underlying 90-second sampling/backoff implementation.

## Verification
- TypeScript/Vite and quota-alert boundary tests for direct % values with null limit, account separation, expired/error states, and independent quota windows.
- Existing DeepSeek official-page parser, Google OAuth, account association, history, refresh concurrency, retry gate, catalog, UI theme and ChatGPT quota-window regressions.
- Isolated packaged Windows EXE tests verify manual counts, read-only last-valid labels, live account collapsible editor and stale recovery explanation. No real profile is used during QA.

## Limits
- Alerts remain opt-in by account; no extra alert is generated just because a value reached zero when an alert was not enabled.
- Official numerical accuracy still depends on authenticated provider pages/queries. Missing data and unverified plans remain unknown rather than invented.
