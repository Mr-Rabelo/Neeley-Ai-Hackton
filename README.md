# Neeley Advising: AI-powered graduation planning

A web app for TCU Neeley School of Business built for the *Graduation Blueprint* case. It reads a student's transcript, builds a semester-by-semester plan from the **TCU Undergraduate 2026-2027 Catalog**, finds what could delay graduation, compares alternative paths, shows job-market data, and sends every decision that needs approval to a real advisor. Claude explains; a deterministic engine does the math.

> **Demo data.** The student is a sample (name and ID replaced). There is no live schedule, so seat counts and meeting times are unavailable. Plans are drafts no advisor has reviewed. Nothing here changes an official record or promises a job, pay or admission.

## How it works

```
 transcript (PDF/text) ──► parser ──┐
        │                           ├─► cross-check ─► StudentRecord
        └─► Claude extraction ──────┘
                                              catalog (3,900 courses, 8 majors, minors, Core)
 StudentRecord ──► Claude profile  ─┐                    │
        │          (claims cite     │                    ▼
        │           transcript)     │          PLANNING ENGINE (plain TypeScript)
        ▼                           │   prerequisites · offerings · delays · slip test ·
 Claude + tools ◄───────────────────┴── alternatives · comparison · advisor packet
   (chat, recommendations, voice)          every output carries sources + confidence labels
        │
        ▼
 verifier: invented courses, unsupported numbers, "you will graduate", "approved" ─► rewrite or caution
```

**The rule that shapes everything:** the engine computes prerequisites, schedules, delays and plans. Claude calls it as a tool and writes the explanation. Claude never calculates credits, terms or eligibility itself.

### What the engine detects (`src/lib/engine`)
- **Prerequisite problems:** missing, same-term, minimum-grade risk (including in-progress courses), ambiguous wording, "concurrent enrollment" handled as corequisite, courses cited in the catalog that do not exist (for example MANA 30350).
- **Missing information:** catalog-year mismatch, unevaluated transfer credit, unmapped Core attributes, no offering data, no section times or seats.
- **Hidden constraints:** pass/no-credit cap, double-major hours, lower-division courses due before declaring a major, writing-emphasis hours.
- **Delays:** earliest finish against a four-year target, the **sharpest bottleneck**, and a **slip test** that re-runs the plan as if each critical course were missed once.
- **Alternatives:** add a minor, change a major, career focus, summer terms, all from the same engine, compared on fixed rows. No path is ranked.
- **Offerings** are only ever `historical_pattern` (the catalog's "Course Typically Offered") or `assumption`. Nothing is `confirmed` without a published schedule.

### Where Claude is used
| Feature | Route | What Claude does | What it cannot do |
|---|---|---|---|
| Transcript reading | `/api/transcript` | Extracts courses from the text; a rule-based parser cross-checks it and disagreements are shown | Override the parser's reading |
| Student profile | `/api/profile` | Strengths, interests, risks, gaps, careers to explore. Every claim must cite transcript courses; unsupported claims are dropped | Use demographics, invent courses |
| Recommendations | `/api/recommend` | Explains next-term courses and optional electives from the engine's plan | Add a course that is not in the catalog or plan |
| Chat | `/api/chat` | Student mode (tools: plan, requirements, what-ifs, courses, market, advisor packet) and prospect mode (one question at a time with clickable chips, fit scoring) | Compute eligibility, approve anything |
| Job market | `/api/market/analysis` | Writes a 3-5 year outlook from BLS data only | Add numbers that are not in the data |
| Voice | `/api/voice/*` | Same brain, spoken style, prospect-level only | See anyone's record |

Every reply is verified against what the tools returned. Problems trigger one rewrite, then a visible caution.

### Job market data (`data/market/market.json`)
BLS Occupational Outlook Handbook, **2025-35 projections** (pages last modified 2026-08-27), 12 occupations mapped to the 8 majors. BLS publishes 10-year projections, so the **3 and 5 year figures are interpolated and always labeled as estimates**. Retrieved through an automated page summary: verify against the linked pages before quoting externally. Routes come from the TCU catalog.

## Run it

```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY (the engine, courses and market data work without it)
npm run dev                    # http://localhost:3000
npm test                       # 61 tests
```

Without `ANTHROPIC_API_KEY` the app still reads transcripts (rule-based), plans, compares, shows market data and the catalog. The AI features say so plainly instead of failing.

### Environment
| Variable | Needed for |
|---|---|
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_FAST_MODEL` | Claude features (defaults: `claude-sonnet-5-5`, `claude-haiku-5-5`) |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Persisting advisor requests, feedback, survey, voice conversations (otherwise in memory) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `ADVISOR_PHONE_NUMBER`, `APP_BASE_URL` | Voice and SMS |
| `ADVISOR_PASSCODE` | Required to open `/advisor` in production |
| `NEXT_PUBLIC_AI_PHONE_DISPLAY`, `NEXT_PUBLIC_ADVISOR_SCHEDULING_URL` | Display values |

Never commit real values. `.env.example` holds names only.

### Supabase
The schema is `supabase/migrations/0001_init.sql` (already applied to the *Neeley Ai - Hackton* project). Row-level security is on with **no public policies**: only the server's service role key can read or write.

### Twilio voice
1. Buy a number. Set its **Voice webhook (POST)** to `https://<your-app>/api/voice/incoming`.
2. Set `TWILIO_AUTH_TOKEN`, `APP_BASE_URL` (the public URL, used to validate signatures), optionally `ADVISOR_PHONE_NUMBER` for "talk to a person" transfers and `TWILIO_ACCOUNT_SID`/`TWILIO_PHONE_NUMBER` for texting a link.
3. Every webhook is signature-validated; forged requests get 403. The caller is not verified, so voice is general information only.
4. Conversation state is stored by `CallSid` in Supabase when configured. Without Supabase it is kept in server memory, which is not reliable on serverless.
5. This uses Twilio's speech `<Gather>` loop, which works on Vercel. A lower-latency upgrade is Twilio ConversationRelay, which needs a small always-on websocket server.
6. A Twilio trial account only calls verified numbers.

### Deploy (Vercel)
Import the repo, framework preset *Next.js*, add the environment variables above. The `data/` folder is traced into the serverless functions.

## Data pipeline (`scripts/`)
- `build_catalog.py`: parses the 2,791-page catalog PDF into `data/catalog/courses.json` (about 3,900 courses with descriptions, prerequisites and typical offerings). Catalog pages list each page's course headers first and the descriptions after, so pairing is done **per page** to avoid drift; four mismatched pages (graduate courses) are logged.
- `data/catalog/neeley.json`: majors, minors, Core Curriculum, lower-division and business core, policies, each with a source and catalog page. Hand-structured from the catalog.
- `data/catalog/calendar.json`: the catalog's academic calendar (Fall 2026 to Summer 2027).
- `make_sample_pdf.py`: renders the sanitized sample transcript as a PDF.

Rebuild the catalog with `python3 -m venv .venv && .venv/bin/pip install pypdf && .venv/bin/python scripts/build_catalog.py "<Undergrad Catalog.pdf>"`.

## Tests (`tests/`)
Transcript parsing (text and PDF), prerequisite parsing, availability labels, the engine on the sample student, **mutation tests** (change one fact, expect the right finding), alternatives and comparison, market data, the AI layer with a scripted fake model (tool loop, verifier, profile validation, extraction cross-check), and the Twilio webhooks with real signature validation.

## Known limits
- No live schedule, so **no meeting-time conflict or seat checks**; the app says so everywhere it matters.
- Catalog year mismatch for the sample (record 2025-26 vs catalog 2026-27) is flagged, not resolved.
- The maximum credit load per term is not in the supplied documents; the plan assumes 15 and says so.
- Double-major, shared-credit and transfer-evaluation rules are not stated in the catalog; these go to an advisor.
- Major "profiles" for prospective-student fit and the career-to-course mapping are **drafts no advisor has reviewed**.
- Login is not wired yet: students load a transcript. Next step: TCU email sign-in (for example Clerk) and an authorized registrar or Stellic feed.
- Real student records need TCU authorization (FERPA) before use.
