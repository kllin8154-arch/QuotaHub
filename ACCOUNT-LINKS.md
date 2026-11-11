# Account reuse and Google identity

Google login provides only the basic Agnovexa One user identity (openid, email, profile).
It does not authorize ChatGPT, DeepSeek or any other independent AI provider.

- Previously authorized official website sessions remain in separate persistent local Chromium partitions. They can be restored without a new login while the provider session is valid.
- Adding an already-connected provider now defaults to reusing that existing account. Only an explicit 'other account' choice opens a separate browser profile.
- Users may explicitly group existing connected accounts beneath their verified Google identity. This does not copy third-party passwords, Cookies or Google tokens into other platforms.
- The local account grouping is encrypted with Electron safeStorage. Its Google account identity key is a SHA256 hash of the stable subject, not a password and not sent to the UI.
- An account already associated with another Google identity cannot be silently re-associated.
- 90-second background sampling uses only real provider API responses or visible metrics in provider-owned quota pages. API accounts also receive a startup sampling pass. Changes are captured with timestamps.
- Historical line and change bar charts do not invent missing samples. Failed sources are marked stale and preserve the last successful value. Polling is near-real-time, not instantaneous streaming.
- Unsupported vendors need a separate website login and metric selection, unless a supported API is available.
- No cross-device account sync is offered.

Security: NEVER commit downloaded OAuth JSON, API secrets, session partitions, user history or runtime account data.
