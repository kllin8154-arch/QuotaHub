# Agnovexa One 0.15.0 — automatic local AI agent discovery and confirmed quota association

## What changed
- Desktop-only, metadata-only discovery of known tool configuration and installation evidence. Uses a fixed allowlist of known Windows config/install directories for OpenCode, Codex, Claude Code, Gemini CLI, WorkBuddy, Cursor, Windsurf, Continue, TRAE, VS Code agent extensions, and others. No file contents, API keys, tokens, browser storage, user paths, shell commands, recursive scans, or arbitrary software enumeration are used.
- The connection center scans once when opened, shows "本机应用" vs "本机配置" badges, allows manual rescanning, and filters to "本机发现". Discovery means **metadata observed**, never authentication or reliable provider billing.
- A user can explicitly choose an already authorized quota account as the actual model-provider source. A separate **确认关联** click is required; only an agent ID + quota provider ID + kind are stored in local app storage, never credentials. Links can be changed or removed independently of OAuth, sessions, quota accounts and history.
- When no authorized quota source is available, the existing provider onboarding remains available. ChatGPT subscription quotas are not inferred from Codex CLI or other agent installations.
- Scan/filter/association/confirm/cancel controls share the existing smoke, clear and warm theme tokens; typical action sizes are 36–42px, with keyboard focus, hover/pressed/disabled states, narrow-window wrapping and no native gray buttons.

## Verification
- TypeScript/Vite, metadata scanner allowlist/symlink/negative and positive cases, privacy assertion that no file content API is called, mapping persistence and invalid data sanitization, catalog/filter and cross-account existing regression tests.
- Windows isolated executable QA (D: profile) exercises agent discovery toolbar, explicit association of a synthetic previously authorized quota account, persistence and unlink, and smoke/clear/warm button geometry/colors before any production activation.
- No real account data, config paths, credentials, user browser sessions, OAuth files or usage history are copied into the public repository.

## Design limits
- The discovery code is deliberately conservative: it may miss applications installed in arbitrary folders. It only detects a known config/install marker, not which API key or paid plan the agent uses.
- Provider selection remains user-confirmed; detection does not grant new official subscription quota APIs.
- Existing 90-second sampling, authenticated browser profiles, Google identity and secure API-key handling are unchanged.
