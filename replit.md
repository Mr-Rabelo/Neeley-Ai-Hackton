# Neeley Advising

The Next.js application is imported in `neeley-advising/`, on branch `feat/ai-advising-app`. Its root `AGENTS.md` contains shared guidance for coding agents.

## Run & Operate

- The `Neeley Advising` workflow runs the app with `cd neeley-advising && npm run dev -- --hostname 0.0.0.0 --port 5000`.
- Tests: `cd neeley-advising && npm test`
- Type check: `cd neeley-advising && npm run typecheck`
- Production build: `cd neeley-advising && npm run build`
- Supabase and Vercel are already configured by the user. Preserve their existing configuration; do not recreate services or replace settings. Never expose or commit secret values.

## Stack

- Next.js 16, React 19, TypeScript
- Supabase for configured persistence
- Claude-powered features with deterministic planning logic
- Twilio voice integration

## Source of truth

- `neeley-advising/` is the imported application repository and has its own Git history and `feat/ai-advising-app` branch.
- Follow `neeley-advising/AGENTS.md` for app-specific architecture, safety limits, tests, and collaboration.
- The planning engine is authoritative for requirements, credits, eligibility, and semester plans; AI may explain results but must not calculate or override them.
