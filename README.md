# Agnovexa One

**Formerly QuotaHub.** The repository retains its historical name to preserve existing links. The Windows app and UI are now called Agnovexa One.

The official ivory and forest-green mark comes from the owner-supplied design. Sources are in public/brand/. Never publish local browser sessions or OAuth JSON downloads.


**Local-first AI quota dashboard** — Windows glass widget, web dashboard and Android project.

Agnovexa One is a desktop-first dashboard for viewing AI subscription usage, API credit balances and historical data. It combines a resizable translucent widget with a full multi-provider usage dashboard.

## Features

- Windows Electron desktop widget with card, horizontal strip, and sidebar layouts, multiple transparency/tint options, corner resize, edge docking, orb and island-style collapse.
- Provider tracking including DeepSeek, ChatGPT, OpenAI API, OpenRouter and configurable API relay accounts.
- Isolated local login sessions for supported official usage pages.
- Real history snapshots, line charts and change bar charts; each metric retains its original unit.
- Responsive web interface, PWA assets and an Android Capacitor native project.

## Status and limits

Version 0.11.0 is an evolving personal project, not an official AI platform application. In the desktop build, authorized login and visible quota detection for DeepSeek and ChatGPT are best-effort. A 90-second sample cycle is attempted while the app is running; webpage redesign, slow provider updates or authentication checks may interrupt collection. Some services require official API credentials or manual records. ChatGPT subscription quotas are not OpenAI API balances.

**Do not confuse data from different platforms, accounts or units.** A dashboard reading is not an authoritative billing record.

## Quick start

Requirements: Node.js 22+, npm. Windows is recommended for native widget functionality.

~~~sh
npm ci
npm run dev
npm run build
npm run test:quota
~~~

The web preview runs on http://127.0.0.1:5173 and does not provide all native Electron features.

Windows desktop and portable build:

~~~powershell
npm run desktop
npm run pack:win
~~~

Portable output is saved under release/ and is intentionally not committed.

Android (requires Android SDK and Gradle/JDK):

~~~sh
npm run android:sync
npm run android:apk
~~~

The Android project is an independent client; it does not automatically inherit Electron's official-site browser capture capabilities.

## Structure

| Path | Description |
| --- | --- |
| src/ | React UI, forms, provider definitions and charts |
| electron/ | Native widget, encrypted provider credentials, quota collection and isolated browser sessions |
| desktop-studio.html | Desktop widget layout and appearance |
| public/ | Application graphics and provider icon assets |
| android/ | Native Capacitor Android project; generated web assets are excluded |
| tests/ | Synthetic quota parser and capture regression tests |

## Google identity sign-in (optional desktop feature)

The Windows Electron edition optionally supports Google identity verification using OAuth 2.0 Authorization Code with PKCE, the system browser, and a 127.0.0.1 loopback callback.

Publisher setup (once): create an OAuth 2.0 client with application type Desktop app at https://console.cloud.google.com/auth/clients. Set up the consent screen (and test users when in Testing mode). In Agnovexa One use Identity & Sign-in > Application OAuth settings to enter the Desktop Client ID. Alternatively supply QUOTAHUB_GOOGLE_CLIENT_ID as a process environment variable. A Desktop Client ID is not a secret; do not commit any access tokens, passwords or local identity records.

End users can then choose Continue with Google. The feature asks for openid, email and profile only. Authorization code and access token stay in memory and are discarded; a verified identity snapshot is stored locally using Electron safeStorage encryption, where available. Logging out removes that local association, without deleting AI platform balances or session profiles.

This is local identity linking, NOT a cloud account, cross-device sync or permission to fetch other AI providers' balances. Google sign-in for Web/Android is not yet enabled. Their existing local mode remains functional.

## Privacy and security

This public repository contains **source code only**, not real logins, API Keys, cookies, session backups, desktop usage history or local preferences. Users must never upload their persistent Chromium session profile or app data folder. Please see SECURITY.md.

Provider logos and names are trademarks of their respective owners. QuotaHub is not affiliated with or endorsed by any provider.

Licensed under MIT (see LICENSE), excluding any third-party trademark rights.

---

## 中文说明

QuotaHub 是本地优先的 AI 平台额度看板，具有 Windows 玻璃态桌面悬浮组件、透明度和布局切换、自动收纳、实时采样历史与趋势图。包含 Web 界面及 Android 客户端项目。

开发：npm ci、npm run dev；Windows 桌面：npm run desktop；构建便携版：npm run pack:win。

用户账号、密钥、Cookie、浏览器登录会话以及额度记录均保存在用户本机，不包含在 GitHub 公开仓库。ChatGPT 和 DeepSeek 网页采集会随平台页面调整而变化，不能保证永久无障碍同步。

A Google Desktop OAuth JSON file can be renamed, for example Agnovexa-One-Google-OAuth-Desktop.json. Configure only its client_id locally. Never commit client_secret JSON or user-data folders.
