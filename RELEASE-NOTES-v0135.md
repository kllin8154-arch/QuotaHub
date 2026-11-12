# Agnovexa One 0.13.5 — automatic quota reset and agent catalog

## New platform library

- Added an in-app searchable, categorized library with 16 developer/desktop AI agents, including OpenCode, WorkBuddy, Codex CLI, Claude Code, Gemini CLI, Cline, Roo Code, Kilo Code, Cursor, Windsurf, Continue, Aider, Goose, OpenHands, TRAE, and Augment Code.
- The library has **智能体工具** and **额度服务** views, Chinese/English search, category filters, concise descriptions, official documentation links, and explicit links to underlying model APIs.
- The UI reuses Agnovexa One's current glass theme. Adding a platform now starts with the searchable catalog instead of a full credential form.
- Agent subscriptions and the third-party API keys used within them are distinct. Choosing an agent does **not** create a fictional connected quota account or read local secrets. Only choosing a supported API quota provider opens the existing secure credential workflow.
- External documentation destinations remain restricted to an explicit HTTPS hostname allowlist.

## Automatically observed subscription reset

- Removed the manual “下次重置日期” entry field.
- A recognized official usage page can now supply a clearly labeled date or time-until-reset directly from its **visible text**, using the existing authorized and isolated browser session.
- The reset is recorded with source type, precision, and observation time, and passed to the dashboard, per-account details, and Windows desktop widget.
- Multiple conflicting quota windows or missing usable reset data show **官方暂未提供**, not an assumed date. Stale observations carry **上次识别** instead of pretending to be fresh.
- Existing old manually entered reset values are left in local records for backward compatibility but not displayed as verified official values. No account cookies, OAuth secrets, passwords or browsing session files enter source control.

## Validation

- TypeScript/Vite build, automatic reset parser, catalog search, official website sampling with reset refresh, Google OAuth, account association, error sanitization, refresh concurrency, and quota warning/backoff tests.
- An isolated packaged Windows EXE validates UI search, provider switching, account details, widget reset display, and one main process without using production credentials.

## Limitations

- Automatic reset times are only available where an authorized official usage page explicitly exposes a single reliable reset. OpenCode/WorkBuddy standalone subscription entitlement APIs are **not** automatically inferred from third-party model API keys.
- Existing periodic sampling is not a provider push channel. Windows builds remain unsigned.
