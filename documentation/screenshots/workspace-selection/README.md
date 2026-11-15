# Company workspace selection — visual review

All captures use the loopback synthetic API and fictional accounts/companies. No production data, credentials, cookies or tokens are shown. `before-*` captures were saved before the UI refinement; `after-*` captures show the implementation. No global CSS or brand tokens were changed.

| Viewport | Before | After |
| --- | --- | --- |
| Desktop 1440, light | [Before](before-1440-light.png) | [After](after-1440-light.png) |
| Desktop 1440, dark | [Before](before-1440-dark.png) | [After](after-1440-dark.png) |
| Desktop 1920, light | [Before](before-1920-light.png) | [After](after-1920-light.png) |
| Desktop 1920, dark | [Before](before-1920-dark.png) | [After](after-1920-dark.png) |
| Tablet 834, light | [Before](before-834-light.png) | [After](after-834-light.png) |
| Tablet 834, dark | [Before](before-834-dark.png) | [After](after-834-dark.png) |
| Mobile 390, light | [Before](before-390-light.png) | [After](after-390-light.png) |
| Mobile 390, dark | [Before](before-390-dark.png) | [After](after-390-dark.png) |

Additional reviewed states:

- [Create dialog, desktop](after-create-dialog-1440-light.png), [mobile dark](after-create-dialog-390-dark.png), [validation](after-create-validation-390-dark.png), [pending](after-create-pending.png).
- [Account menu](after-account-menu-390-dark.png).
- [Loading](after-loading.png), [empty administrator](after-empty-admin.png), [directory error](after-directory-error.png), [unauthorized](after-unauthorized.png), [ordinary member](after-member.png).
- [Full live navigation](after-live-navigation.png), [restricted working features](after-live-navigation-restricted.png).

Reproduce after captures from `apps/web`, after a production build:

```powershell
npx playwright test -c playwright.live.config.ts tests/live/workspace-selection.spec.ts tests/live/workspace-visual.spec.ts
```

The visual test waits for settled surface colours, disables animations during capture, and checks horizontal overflow at each viewport. Functional tests cover dialog focus trapping/restoration, Escape, pending dismissal protection, field errors and permission visibility. These checks are not a full assistive-technology certification.
