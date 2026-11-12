# Agnovexa One 0.13.3 — independent alerts and bounded recovery

## Delivered

- Each platform account can opt into its own percentage warning threshold: low remaining balance, or high usage/spend. Existing profiles are opted out by default.
- Quota warnings require a valid reference limit, a recent successful authorized sample and no active sampling error. Failed or old readings only show sampling diagnostics; no misleading live warnings.
- Multi-account aliases are required when explicitly adding another account under a provider already in use, reducing confusion between independent sessions and histories.
- Background API and authorized website samplers use per-account exponential retry delays, with longer pauses for rate-limit and expired authorization errors. Manual user-initiated refresh remains available and clears the delay after success.
- A missing website window can be restored in the background using its previously authorized isolated browser session; sessions are not wiped or re-created as a new identity.
- Editing an account warning or alias does not fabricate a new successful quota timestamp or history record, nor overwrite the previously observed live value.

## Verification

- Unit and integration tests cover per-account warning boundaries, stale/no-limit conditions, bounded recovery and success resets, Google OAuth isolation, refresh concurrency, and authorized website sampling.
- Windows packaged EXE is verified in an isolated QA profile; no fabricated production data is needed.
- Google sign-in still identifies the Agnovexa One user, not authorization to other providers' usage or billing APIs.

## Limits

- Usage is sampled periodically while the desktop app is running, not pushed by the provider in real time.
- The new alert indicator lives in the dashboard; it does not send OS push notifications, email, or webhook alerts.
- The portable EXE is not code-signed and Windows may display an unknown-publisher warning.
