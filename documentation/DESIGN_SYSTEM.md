# DriveCore visual identity

The authoritative visual branding reference is [Drivecore_Vehicle_Rental_ERP_SRS.pdf](Drivecore_Vehicle_Rental_ERP_SRS.pdf). Its repeated section headings/dividers use red **#D71920**; text and table header bands use charcoal **#28323A**; muted/footer text uses **#65727A**, on white **#FFFFFF**. The cover logo combines red and dark grey. Raster logo shading is not a separate UI palette. Secondary navy document text and blue diagram content are not application accent colours.

The PDF does not specify an interactive or dark theme. Hover shades, selection tints, neutral workspace surfaces and the dark palette below are approved UI adaptations. Keep values centralized in `apps/web/src/app/globals.css` and mapped through Tailwind 4 `@theme inline`. Do not introduce blue application accents.

| Semantic variable | Light | Dark |
| --- | --- | --- |
| primary | #D71920 | #D71920 |
| primary-hover | #B8141A | #B8141A |
| primary-foreground | #FFFFFF | #FFFFFF |
| structural | #28323A | #28323A |
| structural-foreground | #FFFFFF | #FFFFFF |
| background | #F7F7F8 | #101214 |
| surface / card / popover / sidebar | #FFFFFF | #181A1D |
| foreground | #28323A | #F3F4F5 |
| secondary / muted | #F1F2F3 | #23272B |
| secondary-foreground | #28323A | #F3F4F5 |
| muted-foreground | #65727A | #A5ADB4 |
| border (dividers) | #DADDE0 | #383F45 |
| input (control boundary) | #7C858C | #7C858C |
| accent (selection surface) | #FDECEE | #351A1D |
| accent-foreground | #A61118 | #FFB3B6 |
| link | #D71920 | #FF8589 |
| link-hover | #B8141A | #FFB3B6 |
| ring | #D71920 | #FF8589 |
| success / success-foreground | #16A34A / #166534 | #4ADE80 / #86EFAC |
| warning / warning-foreground | #D97706 / #92400E | #FBBF24 / #FDE68A |
| danger / danger-foreground | #B42318 / #8F1D14 | #F97066 / #FDA29B |
| danger-surface | #FEF3F2 | #3A1B19 |

Card/popover foregrounds alias foreground. Sidebar primary/accent/border/ring alias the corresponding semantic variables. `destructive` aliases `danger`. `navy` remains a deprecated compatibility alias to `structural`; do not use it for new text. Existing neutral chart variables remain available. No useful existing token is removed.

## Component recipes

- Filled primary buttons and checked controls use primary red and white text in both themes. Hover uses primary-hover. Do not make dark primary buttons white or pink.
- Links use `text-link hover:text-link-hover`, with underline/visible interaction affordances. Do not reuse the filled primary colour for small dark-theme links.
- Active navigation uses the sidebar accent pair and a red indicator. Hover must preserve the selected treatment. Tables/search/tabs use the accent pair for selected states; nested muted text must remain readable. Selected items use a contrasting red boundary/indicator so the pale tint is not the only state cue.
- Table header bands use structural charcoal and white text. Header row hover must not replace that background.
- Dividers are subtle; input boundaries use a stronger dedicated grey. Focus uses full-opacity ring, with a background offset on filled controls. Invalid borders use danger independently of keyboard focus.
- Success and warning retain green and amber. Use their foreground tokens for small status text on neutral surfaces. Danger uses its own surface/text pair, explicit severity wording and an icon where appropriate. Brand actions do not indicate errors; do not rely on differences between red hues to communicate meaning.
- The exact muted grey is suitable on white/light workspace, but small text on darker grey or selected tints may require foreground/accent-foreground. The shell's grey Mock workspace badge uses foreground for this reason.
- Light is the default regardless of OS preference. Manual `.dark` on the root activates dark tokens and native `color-scheme`; removing it restores light.

Inter, type roles, 24px page padding, 20px card padding, 40px standard controls, 7px control radius, 10px card radius, sidebar/topbar dimensions, compact/icon variants and component APIs are unchanged. Base UI, routing, mock interfaces and business behaviour are preserved. The current shell wordmark remains text-based; this change does not recreate the exact PDF logo artwork.

## Verification and screenshots

`tests/e2e/brand-palette.spec.ts` checks both themes, rendered visible text/background contrast (including alpha-composited ancestor backgrounds), exact primary colours, table headers, selected search, real exported button styles, compact/icon proportions, hover and focus. Captures wait for finite animations and font/paint completion before inspection. A temporary test-only control tray exercises currently unused filled/destructive variants without creating a product showcase screen.

The screen sweep covers `/companies` entry/redirect, combined/branch dashboard, departure and blocker details, every Planned module, search, notifications, profile, error/empty/denied/unavailable states and mobile navigation. Existing tests cover loading, no-results, scoped transitions, keyboard behaviour and reduced motion. This targeted contrast regression check is not a complete WCAG conformance audit; browser-native option popup rendering is platform-dependent.

Representative reviewed captures are in [screenshots/brand-alignment](screenshots/brand-alignment/). The test run also produces full-resolution captures of the remaining inspected states in `apps/web/test-results/browser/` (ignored build artifacts).

- [Dashboard light](screenshots/brand-alignment/dashboard-light.png) / [dark](screenshots/brand-alignment/dashboard-dark.png)
- [Departure light](screenshots/brand-alignment/departure-light.png) / [dark](screenshots/brand-alignment/departure-dark.png)
- [Blocker light](screenshots/brand-alignment/blocker-light.png) / [dark](screenshots/brand-alignment/blocker-dark.png)
- [Selected search light](screenshots/brand-alignment/search-selected-light.png) / [dark](screenshots/brand-alignment/search-selected-dark.png)
- [Controls/focus light](screenshots/brand-alignment/control-focus-light.png) / [dark](screenshots/brand-alignment/control-focus-dark.png)
- [Mobile navigation light](screenshots/brand-alignment/mobile-navigation-light.png) / [dark](screenshots/brand-alignment/mobile-navigation-dark.png)

Backend authentication/authorization and production integration remain outside this visual correction. All operational records and identities are still explicitly labelled mocks.

Verification on 13 November 2026: lint (no warnings/errors), production build, `npx tsc --noEmit`, 17 unit tests and 15 browser tests passed. Chromium covers the complete suite; Firefox/WebKit cover the existing smoke test. Both theme sweeps passed rendered text contrast checks after fixing the Mock workspace badge. Filled primary white-on-red contrast is approximately 5.19:1. Twelve representative captures were visually reviewed. Source audits found no remaining explicit blue application accents, no removed CSS variables and no changes to typography/dimension tokens. The starter page is unchanged. Native operating-system select popup highlight colours may remain platform-controlled.
