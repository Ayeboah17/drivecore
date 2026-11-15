# DriveCore web app

The application lives here; the complete setup and configuration guide is the [frontend README](../../README.md).

From this directory:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Configure a disposable local Laravel API and its actual session-cookie name in `.env.local`. No credentials belong in that file. The default route opens the real authenticated workspace. Isolated demo mode is explicit; network failures never activate it.

Verification: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test:unit`, `npm run test:e2e`, `npm run test:live`. Build before browser tests. The live-path suite starts a synthetic loopback API, not Laravel or production.

Customer/vehicle create, detail and edit are connected. Their lists remain unavailable until the backend supports company/branch scoping before pagination. No delete, fake search or live operational dashboard is implemented.

- [Milestone 3 handoff](../../documentation/MILESTONE_3_HANDOFF.md)
- [Design system](../../documentation/DESIGN_SYSTEM.md)
- [Milestone 2 demo architecture](../../documentation/MILESTONE_2_ARCHITECTURE.md)

Preserve Inter, the approved red/charcoal tokens, existing spacing and Base UI component APIs. The backend repository is read-only for frontend work.
