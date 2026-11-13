# DriveCore — Project Instructions

## 1. Project overview

DriveCore is a modular vehicle rental, fleet management, maintenance, inventory, accounting and business operations platform.

The initial target is a web-based ERP. A separate mobile application for drivers will follow.

The product must be reliable, maintainable, secure and suitable for real business operations.

Do not treat this as a demo dashboard or a collection of disconnected CRUD screens.

## 2. Team ownership

- Product owner and frontend developer: owns frontend implementation, UI/UX and frontend architecture.
- Backend developer: owns Laravel backend, PostgreSQL database, API implementation, business logic and infrastructure.
- GitHub is the source of truth.
- Coordinate API contracts and backend-dependent decisions with the backend owner.

Never independently redefine responsibilities or overwrite another developer's work.

## 3. Technology stack

### Frontend
- Next.js App Router
- React
- TypeScript with strict mode
- Tailwind CSS
- shadcn/ui with Base UI primitives
- TanStack Query for server state
- React Hook Form for forms
- Zod for client-side schema validation
- TanStack Table for complex data tables
- Zustand only for genuinely shared local UI state
- Lucide icons
- Motion for React when animation is justified
- Recharts when data visualization is required

### Backend
- Laravel REST API
- PostgreSQL
- Redis and background queues where required
- Laravel Sanctum authentication
- Server-side authorization and validation

Do not introduce additional libraries without a clear technical reason.

## 4. Architecture principles

- Use modular monolith architecture.
- Follow Next.js App Router conventions.
- Keep components focused and reusable.
- Separate presentation, data access and business logic.
- Avoid unnecessary abstraction.
- Avoid duplicated business logic.
- Prefer server components by default.
- Use client components only when browser interaction or client-side state requires them.
- Keep API access in a consistent service/data-access layer.
- Use TanStack Query for remote server state.
- Do not use Zustand as a replacement for server-state management.

Do not introduce microservices, Kubernetes or unnecessary infrastructure.

## 5. Backend authority

The backend is the authoritative source for:

- Business rules
- Financial calculations
- Tax calculations
- Pricing
- Depreciation
- Permissions
- Approval workflows
- State transitions
- Validation
- Data integrity

Never invent API endpoints, request payloads, response schemas or backend behaviour.

When API information is unavailable:
1. Identify the missing contract.
2. Document the dependency.
3. Use explicitly labelled mock adapters only when needed for frontend development.
4. Never present mock functionality as production-ready.

Frontend permissions are for user experience only. Backend authorization is mandatory.

## 6. DriveCore design system

The visual direction is modern enterprise software.

The interface must feel premium, clear, professional and operationally efficient.

### Colour tokens

- Primary: #2563EB
- Primary hover: #1D4ED8
- Navy: #1E293B
- Background: #F8FAFC
- Surface: #FFFFFF
- Border: #E2E8F0
- Main text: #0F172A
- Secondary text: #64748B
- Success: #16A34A
- Warning: #D97706
- Danger: #DC2626

### Typography

Use Inter as the primary font.

- Page titles: 24–28px, semibold
- Section headings: 18px, semibold
- Card headings: 15–16px, semibold
- Body text: 14px
- Table text: 13–14px
- Labels: 12–13px

### Spacing and dimensions

- Base spacing: 4px
- Page padding: 24px
- Card padding: 20px
- Standard inputs and buttons: 40px
- Table rows: 48–52px
- Card radius: 10px
- Input and button radius: 7px

### Application shell

- Sidebar: 248px expanded, 72px collapsed.
- Topbar: 64px.
- Breadcrumb navigation.
- Global search.
- Notifications.
- User profile menu.

Navigation groups:

- Dashboard
- Operations
- Fleet
- Customers
- Rentals
- Maintenance
- Inventory
- Finance
- Procurement
- Reports
- Administration

Navigation visibility must reflect the user's permissions, but backend authorization remains authoritative.

### Interface principles

- Use consistent page headers.
- Use clear visual hierarchy.
- Prefer clean white surfaces and subtle borders.
- Use restrained colour.
- Avoid unnecessary gradients and shadows.
- Avoid excessive card nesting.
- Avoid oversized dashboard statistics.
- Use text alongside status colours.
- Every page must have appropriate loading, error, empty and success states.
- Forms must have clear validation and submission feedback.
- Tables must support appropriate sorting, filtering and pagination.

## 7. Design quality

Use the installed frontend-design, Apple-design, animation and Unslop skills where relevant.

These skills are advisory tools, not replacements for this document.

Priorities:
1. Usability
2. Information hierarchy
3. Consistency
4. Accessibility
5. Performance
6. Visual polish

Do not blindly imitate Apple interfaces.

Do not produce generic AI-generated dashboard designs.

Avoid:
- Excessive gradients
- Glassmorphism without purpose
- Decorative charts with no business value
- Unnecessary animations
- Random icon usage
- Inconsistent spacing
- Excessive rounded cards
- Fake functionality
- Placeholder content presented as real data

Animations must be purposeful, short and accessible. Respect reduced-motion preferences.

## 8. Security

- Never commit secrets or credentials.
- Use environment variables for configuration.
- Never expose private API credentials to the browser.
- Never rely on frontend authorization for security.
- Validate user inputs.
- Avoid unsafe rendering of untrusted content.
- Do not log sensitive information.
- Never use real customer or financial information in mock data.

## 9. Engineering standards

- TypeScript strict mode.
- Avoid `any`.
- Avoid unnecessary dependencies.
- Avoid duplicated components.
- Use clear naming.
- Keep components maintainable.
- Handle errors explicitly.
- Avoid silent failures.
- Avoid premature optimization.
- Do not disable lint or type checks to hide problems.

Before considering a task complete:
- Run relevant tests.
- Run lint.
- Run TypeScript checks.
- Inspect the final diff.
- Report known limitations.

## 10. Git and collaboration

- Never force-push.
- Never rewrite shared Git history without explicit approval.
- Never commit directly to main.
- Use feature branches.
- Keep changes focused.
- Do not overwrite unrelated developer changes.
- Review migrations, financial logic, authorization and concurrency changes especially carefully.

## 11. Working with Codex

Before substantial implementation:

1. Inspect the relevant project files.
2. Read relevant documentation.
3. Identify dependencies.
4. Clarify missing requirements using $grill-me.
5. Produce a plan using /plan.
6. Wait for explicit implementation approval.

During implementation:
- Follow the approved specification.
- Work in small phases.
- Do not expand scope.
- Do not invent business requirements.
- Keep documentation synchronized.

When asked to review:
- Prioritize correctness and security.
- Identify concrete problems.
- Reference affected files and locations.
- Do not modify files unless explicitly asked.

## 12. Definition of done

A feature is not complete merely because its interface renders.

It must have:
- A clear user workflow.
- Appropriate loading and error handling.
- Validation.
- Permission-aware UI.
- Correct API integration or clearly labelled mock integration.
- Responsive behaviour.
- Accessibility considerations.
- Relevant tests.
- Documentation where appropriate.

If a backend dependency remains unresolved, explicitly state that the feature is not fully integrated.