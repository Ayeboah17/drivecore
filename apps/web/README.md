This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses `next/font/google` to self-host Inter (Latin and Latin Extended), with `display: "swap"`. Sans and heading utilities use Inter; `font-mono` uses system monospace fonts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## DriveCore design foundation

`src/app/globals.css` owns the semantic CSS variables and Tailwind 4 mappings
through `@theme inline`. Keep theme values here rather than duplicating them
in components. Import `cn` from `@/lib/utils`: its existing `cn` dependency is
configured to merge these custom font, spacing, and radius utilities correctly.
Keep the Base UI primitives, component props, state selectors, and `className`
overrides when changing component styles.

### Colors and theme

The authoritative brand reference is the SRS PDF. Primary red is `#D71920` in
both themes, with white button text and `#B8141A` hover. Charcoal is `#28323A`,
muted grey `#65727A`, and white `#FFFFFF`. Light workspace is `#F7F7F8` with
`#DADDE0` dividers. See [the design system](../../documentation/DESIGN_SYSTEM.md)
for all light/dark tokens and semantic status recipes. Use `text-link` for links,
`bg-accent text-accent-foreground` for selected states, and `ring-ring` for focus.
`navy` is retained only as a deprecated charcoal compatibility alias. Existing
card, popover, sidebar, chart and destructive tokens remain available.

Use `text-success-foreground` and `text-warning-foreground` for small status text
on neutral light surfaces, and `text-danger-foreground` on lightly tinted danger
surfaces. These foreground tokens are readable text colors, not automatic text
pairings for solid success/warning/danger backgrounds. Do not assume white text
is readable on every status color. Keep a written status alongside its color.
Primary buttons use white text; destructive buttons and badges retain their
existing tinted treatment with a darker text token. Keyboard focus uses the
semantic ring color; disabled and invalid states remain component-local.

Light mode is the default even when the operating system prefers dark mode.
To activate dark mode manually, add `dark` to the root `<html>` element; remove
it to restore light mode. The `.dark` variable overrides, Tailwind dark variant,
and native `color-scheme` support remain in place. Root activation also themes
portalled Base UI content. There is no theme provider or theme-switching UI.

### Typography

Apply roles explicitly; global heading elements are not restyled.

| Utility                | Size / line height | Weight                           |
| ---------------------- | ------------------ | -------------------------------- |
| `text-page-title`      | 24 / 32px          | 600                              |
| `text-page-title-lg`   | 28 / 36px          | 600                              |
| `text-section-heading` | 18 / 28px          | 600                              |
| `text-card-heading`    | 16 / 24px          | 600                              |
| `text-card-heading-sm` | 15 / 22px          | 600                              |
| `text-body`            | 14 / 24px          | inherited (body defaults to 400) |
| `text-table`           | 14 / 20px          | inherited                        |
| `text-label`           | 13 / 18px          | inherited (Label uses 500)       |

For example: `className="text-page-title lg:text-page-title-lg"`.
Inputs and textareas retain 16px text on small viewports to avoid mobile browser
focus zoom, and use 14px from the existing desktop breakpoint.

### Layout and component dimensions

Dimensions use rem units (values below assume the default 16px root size), while
Tailwind's existing 4px spacing basis remains unchanged.

| CSS variable                | Value | Tailwind usage              |
| --------------------------- | ----- | --------------------------- |
| `--page-padding`            | 24px  | `p-page`                    |
| `--card-padding`            | 20px  | `p-card`                    |
| `--control-height`          | 40px  | `h-control`, `size-control` |
| `--control-radius`          | 7px   | `rounded-control`           |
| `--card-radius`             | 10px  | `rounded-card`              |
| `--table-row-height`        | 48px  | `h-table-row`               |
| `--sidebar-width`           | 248px | `w-sidebar`                 |
| `--sidebar-width-collapsed` | 72px  | `w-sidebar-collapsed`       |
| `--topbar-height`           | 64px  | `h-topbar`                  |

Standard buttons, inputs, select triggers, and single-line input groups use the
40px control height. Button `xs`/`sm` sizes remain 24px/28px; `lg` is 44px.
Corresponding icon buttons remain square. Select `sm` remains 28px. Embedded
input-group buttons retain compact dimensions. Textareas and multiline input
groups grow with content rather than being constrained to 40px.

Default cards use 20px internal spacing and a 10px radius. Compact cards retain
12px spacing with a 15px semibold title. Footers, card actions, and image edge
handling remain supported. Table rows start at 48px and can expand for content;
`h-[52px]` can be used when a workflow calls for the upper end of the
specified range. Shell dimensions are tokens only; no application shell is built.

The starter page intentionally keeps its original explicit styles and is not a
design-system showcase.

### Verification

Run from `apps/web`: `npm run lint`, `npm run build`, then `npx tsc --noEmit`.
For component checks, inspect computed styles and keyboard interactions in a
browser, including compact variants, grouped controls, font loading, and manual
dark mode with portalled content. Do not infer component dimensions from the
starter page.

## Milestone 2 mock application

Open `/companies` to enter the operational workspace. The starter `/` page is unchanged.
This is explicitly a mock demonstration, including when built with `next build`;
it implements no real authentication, authorization, company isolation or Laravel integration.

Use the **Development controls** panel below the workspace to switch access profiles
and deterministic scenarios. Profile/scenario selection is memory-only and resets
on a full reload. Company/branch scope and queue controls live in the URL.
All authorized branches means only the simulated user's accessible branches in
one selected company. Data never aggregates across companies.

Fixtures use a fixed demo clock (13 November 2026, 09:00 UTC), displayed in the
selected company's timezone. Retrieval timestamps are real and separate. Severity,
status and urgency are provisional mock annotations, not business or safety rules.

Available scenarios include empty queues, slow requests, partial failures, refresh
failure with stale same-scope data, search failure, unavailable records and access
removal. Departures/blockers have read-only details; other modules show Planned
explanations. No transaction, fake account setting, approval or vehicle release exists.

Install test browsers once with `npx playwright install chromium firefox webkit`.
Run `npm run test:unit`, `npm run lint`, `npm run build`, `npm run typecheck`, and
`npm run test:e2e`. Browser tests start the production server on port 3100;
Chromium covers the full suite and Firefox/WebKit cover the milestone smoke test.

See [approved specification](../../documentation/MILESTONE_2_SPECIFICATION.md),
[architecture](../../documentation/MILESTONE_2_ARCHITECTURE.md), and
[backend dependencies](../../documentation/MILESTONE_2_BACKEND_DEPENDENCIES.md).

### Ghana demo setting

All demo organizations, branches and identities are fictional Ghana-based examples:
Akwaaba Vehicle Rental (Accra Airport and Kumasi Central) and Sankofa Mobility
(Tema Harbour and Takoradi Depot). Both companies use `Africa/Accra`, with English
Ghana (`en-GH`) date/time formatting. Development users are Kwame Mensah, Ama Owusu
and Kofi Asante. Booking references use AKW/SNK prefixes; vehicles use explicitly
synthetic `DEMO-GH` identifiers rather than real registrations. No financial data
or currency calculations are introduced.
