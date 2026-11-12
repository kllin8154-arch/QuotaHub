# Agnovexa One 0.13.4 — quiet desktop UI, direct quota details

## Improvements

- Removed the two redundant bottom sidebar tiles. The top connection badge now opens a compact local status panel displaying runtime mode, linked accounts, successful synchronization count, and latest saved sample time.
- Overview counters now show natural integers (2 and 0 instead of 02 and 00).
- Harmonized the primary and secondary refresh, add, and view-all buttons across theme variants; hover, pressed, disabled and keyboard-focus states are explicitly styled.
- Aligned quota-card metadata, freshness labels, dividers and action rows, including cards with different progress bar / description lengths.
- Removed the widget footer's redundant local-data explanation. “查看详情” remains the single primary footer action. Selecting an individual account in the widget opens that account's details.
- A lightweight account detail drawer reuses existing history charts and shows latest recorded value, synchronization health, last successful sample timestamp, and warning status; the configuration editor is a deliberate secondary action.
- Widget-to-dashboard details use the existing Electron IPC bridge with a validated account identifier. No extra network service, identity provider, or billing integration is added.

## Data integrity

- Desktop profile, OAuth credentials, API secrets, website sessions and quota history schemas are unchanged.
- No dummy values are inserted into production. Stale data is still identified as stale, not as a real-time push feed.
- The Windows portable binary is currently unsigned.

## Verification checklist

- TypeScript / Vite, Google OAuth, account linkage, concurrent refresh, error sanitization, quota warnings and retry-backoff regressions.
- Native isolated EXE: no fabricated default balances, one main process, widget row → selected-account details, widget footer → details, secondary configuration action, counter formatting, metadata alignment, and status badge popover.
