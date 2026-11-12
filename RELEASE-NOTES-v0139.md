# Agnovexa One 0.13.9 — UI consistency and service metadata

## Included
- Seven service-form categories: API, subscription, mixed, model gateway/relay, agent/IDE, local/self-hosted, other. This is **display-only metadata** stored on the original provider record; the existing API vs subscription billing category, auth sessions and quota sampling logic remain separate and unchanged.
- Account configuration footer has equal-height 44px Cancel/Save actions and consistent focus, active and disabled states.
- Account warning editor is a compact single-row toggle and percent input, with an explicit warning when no reference limit is available; alerts remain opt-in and require fresh authorized quota samples.
- Agent/platform catalog buttons and cards explicitly use theme-safe glass surfaces instead of browser-native gray ButtonFace. Search, tabs, selection, expanded details and mobile layout share the same visual tokens.
- Preferences cards in each desktop grid row automatically stretch to equal height without arbitrary fixed-height content; narrow layouts retain natural height.
- Quota trends and the sampling information banner follow smoke/clear/warm themes, including chart cards, line colors, category and period controls, no dark chart panel in the light theme.

## Validation
- TypeScript/Vite build and full regression suite for DeepSeek browser balance extraction, Google OAuth, account links, web sampling, 5-hour/weekly subscription windows, history refresh, quota alerts and retry handling.
- An isolated Windows EXE QA uses synthetic local provider records and computed browser styles to check real card backgrounds, editor options, save/cancel dimensions, warning form spacing, light/dark charts and settings card height. It never accesses production tokens or user history.

## Limitations
- Service type is descriptive metadata, not proof of a new API adapter. An agent tool may still need an authorized underlying quota provider to obtain numeric data.
- Windows portable build is unsigned. Quota polling and browser session semantics are unchanged.
