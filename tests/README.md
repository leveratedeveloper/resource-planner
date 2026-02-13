# Playwright Automation Suite

## Required Environment Variables

- `E2E_PROJECT_ID` (required)
- `DATABASE_URL` (required in CI)
- `E2E_BASE_URL` (optional, defaults to `http://127.0.0.1:3000`)
- `INSIGHTS_API_TOKEN` (optional, required only if `/api/insights` auth is enabled)
- `OPENAI_API_KEY` (nightly `@ai-live` tests only)

## Local Environment Setup

1. Copy `/Users/leverate/Projects/resource-planner/.env.e2e.example` to `/Users/leverate/Projects/resource-planner/.env.e2e.local`.
2. Fill required values.
3. Run tests. `playwright.config.ts` auto-loads `.env.e2e.local`, `.env.e2e`, and `.env.local` (in that order, without overriding shell env vars).

## Commands

- `npm run test:e2e:smoke`
- `npm run test:e2e`
- `npm run test:e2e:nightly`
- `npm run test:e2e:api`
- `npm run test:e2e:a11y`
- `npm run test:e2e:audit:selectors`
- `npm run test:e2e:audit:fixtures`

## Tagging

- `@smoke`
- `@timeline`
- `@api`
- `@insights`
- `@a11y`
- `@nightly`
- `@ai-live`
- `@quarantine`
