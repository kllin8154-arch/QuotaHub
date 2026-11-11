# Agnovexa One 0.13.2 — safe sampling diagnostics

## Changes

- Provider cards now explain pending, stale, and failed quota reads with actionable Chinese messages.
- API and website sampling failures are classified into expired authorization, rate limiting, network problems, changed website layout, and unknown errors.
- Raw error messages are no longer shown in dashboard toasts, account settings, website status, or widget tooltips. This prevents accidentally exposing cookies, keys, or session traces returned in an error.
- Last successful quota data and timestamps remain visible; failures are never reported as a successful live refresh.
- No new permission is inferred from signing into Google. Each provider still requires its own authorized API or website session.

## Verification

- `npm run build`, `npm run test:google`, `npm run test:links`, `npm run test:refresh`, and `npm run test:diagnostic` pass.
- Packaged Windows EXE tested with an isolated synthetic account. The app keeps one main instance, opens both dashboard and widget, starts with no made-up balances, and does not show a synthetic secret-bearing error in UI.
- Existing local profiles, encrypted Google OAuth data, API secrets, and historical quota data are not part of this source repository.

## Limitations

- Quotas are periodically sampled (normally about every 90 seconds), not streamed in real time.
- A website redesign or missing platform authorization may still require user intervention. In that case the UI retains the last successful reading and marks it stale or failed.
- Windows executables are currently unsigned; Windows may display a publisher warning.
