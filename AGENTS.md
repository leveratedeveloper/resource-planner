# AGENTS.md

## Personality
- The agent must be concise and operate as an expert developer.
- When identifying mistakes, the agent must mention them in the same order as the user's instruction sequence.
- The agent should suggest better practices when relevant, but must not change requested logic unless the user explicitly asks for a logic change.

## Project Overview
Resource Planner is a Next.js-based workforce planning system for managing employee allocation, project assignments, and capacity insights. It combines a React frontend with API route handlers and integrates external Timetrack data with assignment persistence.

The repository is organized to separate UI, API, and domain logic:
- `app/`: App Router pages, global app shell, and server route handlers (`app/api/*`).
- `components/`: UI and feature components (timeline, setup, insights, export, filters, and shared UI primitives).
- `lib/`: Core business logic, API clients, analysis engines, data access, validation, security, and export utilities.
- `hooks/`: Reusable React hooks for view logic and data handling.
- `context/`: Application and authentication context providers.
- `tests/`: Whitebox and blackbox Vitest suites.
- `scripts/`: One-off operational scripts (debugging, parsing, and migration runners).
- `migrations/`: SQL migration files for schema updates.

Standard workflow:
1. Think through the problem before implementing.
2. Check in with the user before executing and writing code lines.
3. Add a summary section after writing code, clearly stating what changed.

## Development Command
Use the following npm commands from the repository root:

- `npm run dev`
  - Starts the Next.js development server for local development.
  - Use when building or debugging features interactively.

- `npm run build`
  - Produces a production build of the Next.js app.
  - Use to validate production compilation before release.

- `npm run start`
  - Starts the built production server.
  - Use after `npm run build` to test runtime behavior in production mode.

- `npm run lint`
  - Runs ESLint for code-quality checks.
  - Use before submitting changes.

- `npm run test`
  - Runs the Vitest suite once.
  - Use for fast CI-like verification.

- `npm run test:watch`
  - Runs Vitest in watch mode.
  - Use during active development for rapid feedback.

- `npm run test:coverage`
  - Runs tests with coverage reporting.
  - Use when validating test depth or preparing quality reports.

- `npm run migration:add-total-hours`
  - Executes `scripts/run-migration-add-total-hours.ts`.
  - Use when applying the total-hours schema/data update path.

- `npm run migration:add-is-adjustment`
  - Executes `scripts/run-migration-add-is-adjustment.ts`.
  - Use when applying the is-adjustment schema/data update path.

## Architecture
- Frontend
  - Built with Next.js App Router, React, TypeScript, and Tailwind CSS.
  - Primary user flows are composed in `app/page.tsx` and feature modules under `components/`.
  - Client-side data fetching and caching are managed with TanStack Query hooks in `lib/query/hooks/`.

- Backend
  - Implemented via Next.js route handlers in `app/api/*`.
  - Route handlers coordinate auth checks, external API access, validation, and assignment CRUD.

- Auth
  - Login is handled through Timetrack API integration (`app/api/auth/login/route.ts` and `lib/api/timetrack-client`).
  - Session state is persisted via HTTP-only cookie storage (`lib/auth/session.ts`).
  - Request gating is enforced with middleware (`middleware.ts`) and per-route session checks.

- Database
  - PostgreSQL is the primary assignments datastore (via `DATABASE_URL`/`POSTGRES_URL` paths in the assignment DB layer).
  - MySQL compatibility/fallback is present in the data access layer (`lib/mysql-assignments/db.ts`) and MySQL bridge/API client modules.


- Cache
  - Server-side analysis caching uses an in-memory LRU-style cache (`lib/analysis/analysis-cache.ts`).
  - Client-side request/state caching uses TanStack Query.
  - Insights endpoint also includes rate limiting logic (`lib/security/insights-rate-limit.ts`).

Security note:
- Do not place secrets, credentials, or private tokens in docs or committed files.
- Reference required environment variable names and setup steps instead of embedding sensitive values.
