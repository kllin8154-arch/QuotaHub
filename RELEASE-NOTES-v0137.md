# Agnovexa One 0.13.7 — quota-window reset extraction hotfix

This incremental patch improves official ChatGPT / Codex usage page parsing without modifying any Google OAuth credentials, cookies, billing authorization or account history.

- The visible-text extractor stops at distinct 5-hour and weekly quota window headings, avoiding duplicate lookahead that could incorrectly combine two reset countdowns or mark one ambiguous.
- Supports official countdown text such as “2小时45分” as well as “2小时45分钟”.
- The 5-hour and weekly allowances remain separately scoped; the older generic ChatGPT reset field remains explicitly untrusted.
- Current plan tier is reported only when the official account page explicitly labels it; pricing upsells do not identify the active plan.
- The dashboard, compact widget and details UI from 0.13.6 are unchanged.

## Verification

- Source excerpt extraction against two 0%/84% windows, explicit plan tests, countdown variants, live website adapter fixtures, existing OAuth/session/refresh regressions.
- Actual isolated Windows executable verification and safe production backup/activation; old installations remain available for rollback.
