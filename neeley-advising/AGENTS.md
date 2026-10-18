# Agent Instructions

## Project
Neeley Advising is a Next.js app for TCU Neeley students. It supports transcript intake, degree planning, career exploration, advisor handoffs, and related advising workflows. Supabase and Vercel are already configured for this project; inspect and preserve the existing setup rather than configuring from scratch. Never expose or copy secret values.

## Setup and checks
- Install dependencies with `npm install`.
- Run the test suite with `npm test`.
- Run TypeScript checks with `npm run typecheck`.
- Verify production compilation with `npm run build`.
- Copy `.env.example` to `.env.local` for local configuration only if needed; never commit `.env.local` or secret values.

## Architecture and correctness
- Treat the deterministic planning engine in `src/lib/engine` as the authority for prerequisites, eligibility, credits, terms, delays, and plan comparisons. Do not have an LLM calculate or override those results.
- AI features may explain or summarize tool output; preserve evidence, sources, confidence labels, and visible cautions. Do not invent courses, requirements, job-market figures, approvals, or graduation guarantees.
- Add or update focused tests for behavior changes, especially planning rules, AI fallbacks, data validation, and external webhooks. Avoid unrelated changes.

## Data, privacy, and product limits
- The committed student record is sanitized demo data. Do not add real student records, transcripts, or personally identifying information to source control, tests, logs, or fixtures.
- There is no live schedule or seat data. Do not present course offerings, availability, meeting times, or enrollment capacity as confirmed unless the app is updated to use an authoritative current source.
- Career 3- and 5-year figures are interpolated estimates, not BLS-published projections. Preserve that distinction in calculations and UI copy.
- Treat career-to-course mappings and major profiles as draft guidance until reviewed by an authorized advisor. The app does not change official records or replace advisor approval.

## Collaboration
- Make changes on a task-specific branch and use pull requests to merge. Do not commit secrets or push directly to the default branch.
- Keep documentation and `.env.example` synchronized when configuration or behavior changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
