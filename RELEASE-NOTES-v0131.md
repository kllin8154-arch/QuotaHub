# Agnovexa One 0.13.1 — one refresh, one latest snapshot

## Shipped

- A widget-initiated refresh now calls both the authorized official website quota sampler and the saved API account sampler.
- Background, manual and widget refreshes share in-flight tasks instead of reloading the same website simultaneously.
- Once sampling completes, the widget obtains the current validated local account snapshot. A stale pre-refresh copy is never written over fresh balances.
- Visible widget refresh state indicates pending and failed requests; individual accounts retain last successful values with stale/error marks.
- Windows desktop session persistence and Google identity separation remain unchanged. The identity Google token does NOT unlock third-party AI platform quotas.

## Tests

- Unit tests: overlapping refresh calls share one run, API and web results do not overwrite each other, a rejected refresh does not pretend to have succeeded.
- Web monitor regression: manually requested and scheduled samples overlap, but exactly one official page read and one history point are produced.
- Existing Google PKCE, DeepSeek/ChatGPT auto-link, historical data, stale detection tests remain in CI/regression suite.

The product samples around every 90 seconds while running, not instant push streaming. Real balances require supported official endpoints or authorized visible data in a platform's own usage page.
Never commit local OAuth JSON, API secrets, session Cookies, user history, or encrypted local account files.
