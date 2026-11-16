# Agnovexa One 0.15.1 — safer discovery of custom agent locations and provider hints

## Behavior
- Expanded the Windows **metadata-only** auto-discovery allowlist to the OpenCode global managed configuration location and configured XDG home, with support for explicit OpenCode/Codex environment overrides. The default scan still checks existence of a small bounded set of paths and never reads configuration files.
- Agent details now offer **指定目录** with a user-driven OS directory picker; saved custom locations remain in local per-user profile at `agent-locations.json` and never leave the Electron main process. **忘记目录** removes the mapping, not the original files. Invalid, drive-root, redirected or symbolic-link directories are rejected.
- For **OpenCode**, **Codex**, and **Continue** only, **选择配置并识别** opens an explicit OS file picker. Only a selected, supported, ordinary config file up to 64 KiB is read once in the local main process. Supported formats: OpenCode `opencode.json/jsonc`; Codex `config.toml`; Continue `config.json/yaml/yml`. The parser uses known `model`, `provider`, `providers`, or `model_provider` fields and returns **only an allowlisted provider kind**. It never returns config contents, arbitrary string values, local file paths or keys.
- Provider hints reorder previously authorized quota sources, but do not select them, authorize anything, provide usage data, or alter existing API/subscription billing. A distinct confirmation click is still required to create an agent-to-provider display association.
- New local-action controls are 38px high minimum and use the existing smoke/clear/warm color tokens, including hover/focus/active/disabled states, responsive wrapping, and narrow layout.
- All existing history, official sampling, error recovery, encrypted Google identity and API key storage remain unchanged.

## Limitations
- A configured model name by itself does not establish the billing provider. Inconclusive config files return unknown. Custom tool configs outside the supported formats are intentionally not parsed; this release does not claim to read subscriptions automatically.
- User-selected directory paths are kept locally, including backup, and are **not** uploaded to GitHub or any service.
- Windows portable EXE remains unsigned.

## QA
- New synthetic regression cases test OpenCode JSONC comments/trailing commas, Codex top-level TOML, Continue YAML/JSON, secret sanitization, file size/name/symlink/path boundaries, cancel/forget, and isolated persistence.
- Build and complete prior Google OAuth, DeepSeek, subscription-window, quota reliability and UI regression suite.
- Packaged Windows Electron isolated-profile QA checks agent list, local controls, click behavior, three tone modes, existing quota association and all prior dashboard paths before production activation.
