# Agnovexa One 0.13.6 — verified plan tier, separate 5-hour and weekly limits

## Changes

- ChatGPT / Codex / Work subscriptions can display separately identified **5 小时限额** and **每周限额**, each with its own remaining percentage and reset countdown. No more shared or invented single `resetAt`.
- The account plan displays only when explicitly confirmed by visible current-plan information on the authorized official webpage (Plus, Pro 100, Pro 200, Pro 500, and explicitly displayed 5x/10x/20x aliases). A pricing/upgrade advertisement does not count as a verified plan. Unknown tiers remain unknown.
- Data stays scoped to the existing account ID, authorized session and timestamp. If the official page omits a window, the UI shows that the window is unverified instead of guessing.
- Dashboard cards, account detail drawer, and desktop widget display the independent windows. Countdown-based resets remain relative to sample time to prevent confusing fixed-time forecasts.
- Compact desktop widget row layout and runtime scrollbar suppression prevent the bright scrollbar and cramped text observed by the user.
- Older manually entered subscription resets are kept for backward compatibility but are **not** used as a ChatGPT-wide reset.

## Verified

- TypeScript build, window parser against a 0% five-hour and 84% weekly screenshot scenario, explicit tier safeguards, and existing OAuth/website/API sampling regressions.
- Windows packaged EXE isolated QA with a synthetic account, different remaining percentages, and two separate countdowns. No production account data used in QA.

## Limits

- Website content and plan labels may change. Unknown values stay unverified until a fresh authorized sample provides evidence.
- App polling is periodic, not a push subscription feed; Windows executable is not code-signed.
