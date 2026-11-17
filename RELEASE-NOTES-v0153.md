# Agnovexa One 0.15.3 — local window recovery, safe official-page throttling, tray-only widget

## Bug fixes
- **Tray-only floating widget**: the widget no longer creates an unnecessary Windows taskbar button. Existing user settings that previously saved `showTaskbar:true` are safely interpreted as `false` in the new runtime. Its tray icon can still show/hide the widget; the full dashboard remains an ordinary separate window.
- **Avoid blank main dashboard**: wait for the bundled React sidebar to mount before displaying the dashboard, retry local loading once when it fails, detect a renderer crash or stalled initial navigation, and provide a local recovery page with an explicit reload link instead of a permanently white surface. Development Vite URL remains supported.
- **Provider web-page errors**: DeepSeek can respond to requests with **HTTP 429 (Too Many Requests)**. The monitoring browser now recognizes relevant main-frame HTTP errors and failed/empty loads and shows an actionable, offline failure page when the user opens it, including links to retry the known HTTPS official page or open it in the system browser. The offline page never displays, copies or changes authentication tokens.
- **Reduce background request pressure**: automatic DeepSeek hard page reloads happen no more than once per five minutes, with 429/backoff cooling of at least 15 minutes. A no-reload DOM is not misreported as a freshly collected numerical value. Regular dashboard sampling and other independently authorized providers remain available. Normal transient non-429 errors still allow explicit manual retry.
- **History and authorization preserved**: DeepSeek's last authenticated balance is kept as *last valid*, not invented current balance. No cookie clearing, identity change, credential migration, or user account rebinding.

## Verification
- Source regression covers tray-only migration, dashboard React mount / fallback logic, response-code classifiers, HTML-safe known-host URLs, 429 per-account retry isolation, reduced DeepSeek reload frequency and official page behavior.
- New DeepSeek mock-integration test generates a synthetic HTTP 429 without any live website requests: expects explicit explanatory UI, throttled subsequent sampling and preservation of previous real history.
- Prior Google OAuth, ChatGPT 5-hour/weekly allowances, link isolation, account refresh concurrency, alert, restore, agent library, and theme regressions.
- Packaged Windows EXE checked in an isolated D: QA profile that intentionally sets legacy `showTaskbar:true`: runtime must report tray-only `showTaskbar:false`; dashboard root must be rendered before display.
- Final release installation preserves all locally encrypted credentials, cookies and usage history. No user profile data or keys are committed to GitHub.

**Important:** A provider's live HTTP 429 response cannot be bypassed by the desktop app. Fresh DeepSeek sampling will recover only if the official provider becomes accessible again. The portable EXE is not code-signed.
