# Google OAuth network and callback fix (v0.11.1)

The desktop app uses an isolated, **non-persistent** Electron Chromium session to exchange Google OAuth authorization codes and retrieve verified profile data. This uses the Windows system proxy settings, unlike a raw Node network stack.

After the Google browser callback, the local browser page waits for the token exchange, userinfo verification and local encrypted save to finish. It shows success only after those steps succeed; otherwise it displays an actionable error and the desktop app shows the reason. A Google callback receipt is **not** login completion.

The app does not store the OAuth authorization code, access token, refresh token, browser cookies, or the downloaded OAuth client_secret JSON. It stores only the verified Google subject, email and display name in an encrypted local identity record. The desktop owner supplies only the installed Desktop OAuth Client ID locally.

Tests include a simulated Google token/userinfo exchange and failure-path assertion. These are not a substitute for a real account's interactive browser consent. Do not commit Google OAuth JSON files or API credentials.
