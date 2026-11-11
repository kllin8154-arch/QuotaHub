# Agnovexa One v0.13.0 — Real-data reliability

This release improves reliability while preserving the familiar glass desktop widget.

## Changes

- One running instance per user-data profile. Clicking the shortcut again brings back the existing window rather than creating another browser session writer.
- Opening the full dashboard reuses an existing dashboard, rather than spawning duplicates.
- Browser-based auto-binding no longer forces open a large dashboard when a hidden desktop widget receives a sample.
- An account is "Sync healthy" only after an actual successful sample in the last five minutes. Other states are "Waiting for first sample", "Data expired", "Collection failed" and "Manual record".
- Last successful figures remain visible when the source becomes stale, with clear old-value labeling in both dashboard and transparent desktop widget.
- Active connection counters use healthy sources, not merely saved credentials. Paused sources appear among attention items.
- Manual webpage refresh errors are saved to the account state instead of being presented as success.
- Existing real DeepSeek and ChatGPT sessions are preserved. The identity grouping code still requires explicit user consent and does not use a Google login as a third-party quota credential.

## Quality assurance

- TypeScript / Vite build passed.
- Google OAuth identity, DeepSeek / ChatGPT web sampling, history, encrypted grouping tests passed.
- Six sync-health boundary cases and readable timestamp labels passed.
- Installed EXE tested with an isolated synthetic profile: second launch exited, one process owned the profile, reuse/grouping UI worked, line and change-bar charts rendered.
- Synthetic fixture is not part of this release and MUST NOT be copied into production data.
- No downloaded Google OAuth JSON, live user accounts, keys, cookies or balance-history databases belong in Git.

Background sampling runs at around 90-second intervals while the app is running. This is near-real-time **sampling**, not server-sent streaming. Providers may expire sessions or change official webpages; those cases are shown as paused/expired, never silently reported as healthy.
