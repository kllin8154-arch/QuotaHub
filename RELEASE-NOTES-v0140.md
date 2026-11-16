# Agnovexa One v0.14.0 — personal identity and responsive controls

## Changes
- Google identity entry moved from the top-right toolbar to the bottom of the sidebar. It opens the existing secured IdentityPanel and displays the verified account name, portrait, and linked state.
- OAuth now accepts the picture URL already returned by the authorized Google OpenID Connect userinfo endpoint, **only** when the URL uses HTTPS on googleusercontent.com or its subdomains. Picture and identity information stay encrypted locally. Previously linked identities that have no picture automatically display a name initial; no sign-in or access-token retention is imposed.
- Clicking outside the status popover, navigating, or pressing Escape closes it, while clicking inside retains it. The status trigger remains an ordinary toggle.
- The browser monitoring note inside the account editor no longer shows a light gray block on the dark modal. Advanced API Key action is now a secondary pill and sampling badge has readable compact styling.
- Overview refresh, bind, and account list action buttons use the same 41px design tokens with clear focus, hover and active states in smoke, clear, and warm themes.
- Account data, quota refresh, history, and Google grouping semantics are unchanged.

## Testing
- TypeScript/Vite, Google OAuth callback and encrypted persistence, validated portrait URL test (including domain spoof rejection), UI tests for status dismissal and sidebar entry, quota source and concurrency regressions.
- Native Windows release validated in isolated D: user profile and CDP-driven UI interaction before activating production.
- No user credentials, personal profile, browser cookies, token, or usage history committed.

## Limitation
An identity saved before this version has no stored photo URL; its name initial is displayed until a future authorized Google sign-in returns one. No unauthorized lookup or forced reauthentication is performed.
