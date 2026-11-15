# Demo workspace and required branch setup

All screenshots use fictional demo records or the loopback synthetic API. No production accounts, credentials, tokens or live records are captured.

| View | Screenshot |
| --- | --- |
| Previous standalone walkthrough, mobile dark | [Before](before-demo-dark-mobile.png) |
| Company and branches together, desktop | [Demo setup](after-demo-setup-1440-light.png) |
| Company and branches together, mobile | [Demo setup](after-demo-setup-390-light.png) |
| Empty dashboard after setup, 1440 | [Dashboard](after-demo-dashboard-empty-1440-light.png) |
| Dashboard with created record counts, 1440 | [Dashboard](after-demo-dashboard-1440-light.png) |
| Desktop 1920 | [Dashboard](after-demo-dashboard-1920-light.png) |
| Tablet 834 | [Dashboard](after-demo-dashboard-834-light.png) |
| Mobile 390 light | [Dashboard](after-demo-dashboard-390-light.png) |
| Mobile 390 dark | [Dashboard](after-demo-dashboard-390-dark.png) |
| Customer form, mobile dark | [Dialog](after-demo-customer-dialog-390-dark.png) |
| Live setup before first branch | [Setup](after-live-setup-1440-light.png) |
| Live setup with multiple branches | [Ready](after-live-setup-ready.png) |

The before capture comes from the previous three-test walkthrough suite, executed before implementation. There was no previous demo dashboard to capture. After captures are produced by `tests/live/workflow-demo.spec.ts` and `tests/live/setup.spec.ts` using the production build. The responsive test checks horizontal overflow, keyboard entry, dialog focus, mobile navigation, reduced motion and offline operation after loading. This is functional visual review, not a full assistive-technology certification.

Reproduce from `apps/web` after `npm run build`:

```powershell
npx playwright test -c playwright.live.config.ts tests/live/workflow-demo.spec.ts tests/live/setup.spec.ts
```
