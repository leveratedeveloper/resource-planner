# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Resource Planner is a Next.js workforce-planning app: employee allocation timelines, project assignments, and capacity insights. It integrates an external **Timetrack** API (auth + source-of-truth directory data) with a local assignments database. See `AGENTS.md` for additional agent instructions.

## Commands

- `npm run dev` — dev server (also initializes the OpenNext Cloudflare dev adapter via `next.config.ts`)
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)
- `npm run build` — production build. **`ignoreBuildErrors: true` is set in `next.config.ts`, so a passing build does NOT mean the code type-checks.** Use `npx tsc --noEmit` to actually check types.
- `npm test` — run the full Vitest suite once (but see test warning below)
- `npx vitest run tests/whitebox/<file>.test.ts` — run a single test file
- `npm run test:watch` / `npm run test:coverage`
- `npm run preview` / `npm run deploy` — OpenNext build + Cloudflare Workers preview/deploy (`wrangler.jsonc`)
- `npm run migration:*` — run SQL migrations from `migrations/` via tsx scripts in `scripts/`

## Tests: whitebox vs blackbox

- `tests/whitebox/` — pure unit tests (node environment, mocked deps). Safe to run anytime.
- `tests/blackbox/` — **NOT unit tests.** They `fetch` a live dev server at `http://localhost:3000` and exercise real API routes, including POSTs that write to whatever database that server is connected to. They require a running dev server and will mutate its data. Before running `npm test` (which includes them), verify which DB the dev server points at.

## Architecture

**Stack:** Next.js 16 App Router + React 19 + TypeScript + Tailwind 4 (shadcn-style UI in `components/ui/`). Deployed to **Cloudflare Workers** via `@opennextjs/cloudflare` — not Vercel, despite some older comments in the code saying otherwise. `pg`/`mysql2` are kept in `serverExternalPackages` so the workerd bundler resolves them correctly.

**Main page flow:** `app/page.tsx` → `app/HomeClient.tsx` composes the planner UI. Feature components live under `components/` (timeline, timeline-v2, setup, insights, export, filters).

**Dual-database routing** (`lib/mysql-assignments/db.ts`): if `DATABASE_URL` is set → PostgreSQL (production); otherwise → local MySQL. Queries are written in MySQL syntax and translated to Postgres at runtime by `convertMySQLToPostgreSQL()`. Schemas: `lib/mysql-assignments/schema.sql` (MySQL) and `schema.postgres.sql`. Migrations are raw SQL files in `migrations/`, applied by tsx runner scripts — there is no migration framework (the `drizzle/` dir is vestigial; drizzle is not a dependency).

**Planner directory sync** (`lib/planner-directory/`): mirrors Timetrack departments, brands, campaigns, pitches, and employees into local directory tables. Built around a sync engine with leases (`sync-lease.ts`), freshness checks, repair, and batched writes. Triggered on-demand (`sync-trigger.ts`) and via the admin route `app/api/admin/planner-directory-sync`. The read path backs `app/api/planner/filter-options`, `home-bootstrap`, and `timeline`.

**Timeline — two generations coexist** (branch `timeline-rework` is migrating to v2): `lib/timeline` + `components/timeline` is v1; `lib/timeline-v2` + `components/timeline-v2` is the rework. The v2 controller (`components/timeline-v2/useTimelineV2Controller.ts`) still imports some v1 modules, so changes to `lib/timeline` can affect both.

**Client data layer:** TanStack Query. Hooks in `lib/query/hooks/`, centralized query keys in `lib/query/queryKeys.ts`, cross-feature invalidation via `lib/query/invalidatePlannerData.ts`.

**Auth:** login proxies the Timetrack API (`app/api/auth/login` → `lib/api/timetrack-client.ts`). Session is a JSON HTTP-only cookie (`lib/auth/session.ts`); access levels in `lib/auth/access*.ts`. `middleware.ts` protects pages (`/`, `/dashboard`) but deliberately lets most `/api/*` routes through — API routes do their own session checks.

**Insights:** `app/api/insights` → analysis engines in `lib/analysis/` (capacity, conflicts, forecasting, scenario simulation) + OpenAI-backed generation in `lib/ai/`. Server-side in-memory LRU cache (`lib/analysis/analysis-cache.ts`) and rate limiting (`lib/security/insights-rate-limit.ts`).

## Environment variables

`DATABASE_URL` (Postgres; presence switches DB routing), `MYSQL_ASSIGNMENTS_*` (local MySQL fallback), `TIMETRACK_API_URL`, `MYSQL_API_USERNAME`/`MYSQL_API_PASSWORD` (Timetrack bridge), `OPENAI_API_KEY`, `INSIGHTS_API_TOKEN`, `API_SECRET_KEY`. Local config lives in `.env.local`.
