# Google OAuth network and callback fix (v0.11.1)

The desktop app uses an isolated, **non-persistent** Electron Chromium session to exchange Google OAuth authorization codes and retrieve verified profile data. This uses the Windows system proxy settings, unlike a raw Node network stack.

After the Google browser callback, the local browser page waits for the token exchange, userinfo verification and local encrypted save to finish. It shows success only after those steps succeed; otherwise it displays an actionable error and the desktop app shows the reason. A Google callback receipt is **not** login completion.

The app does not store the OAuth authorization code, access token, refresh token, browser cookies, or the downloaded OAuth client_secret JSON. It stores only the verified Google subject, email and display name in an encrypted local identity record. The desktop owner supplies only the installed Desktop OAuth Client ID locally.

Tests include a simulated Google token/userinfo exchange and failure-path assertion. These are not a substitute for a real account's interactive browser consent. Do not commit Google OAuth JSON files or API credentials.

## Desktop client JSON compatibility (v0.11.2)

Some Google Desktop OAuth clients require client_secret during token exchange even with PKCE. The app offers Import Google OAuth JSON using a native local-file picker. It reads installed.client_id and installed.client_secret locally, verifies the file type, and encrypts the client secret via Windows OS storage (Electron safeStorage) before saving it to local user-data. The original downloaded JSON file is never copied into an application release or uploaded to GitHub.

The token exchange uses the secret only in memory. Google access tokens, authorization codes and cookies are never persisted by the identity component. The renderer only gets clientSecretConfigured as a boolean, never the secret itself.

The app publisher imports their downloaded desktop OAuth JSON once per target machine. Browser login remains an independent end-user interaction.

Google's installed-app protocol documentation describes the client_secret field as optional, but this compatibility implementation accounts for observed endpoint behavior.
