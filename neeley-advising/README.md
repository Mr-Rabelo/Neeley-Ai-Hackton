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
| Voice | Vapi browser calls + `/api/vapi/tools` | Walks callers through Neeley's programs and helps them choose, from the same data tools; open-ended questions go through the verified chat loop | See anyone's record |

Every chat reply, and every voice answer from `neeley_advising_answer`, is verified against what the tools returned. Problems trigger one rewrite, then a visible caution. Voice replies built from the direct data tools are spoken by the Vapi model, which the system prompt limits to tool results; they skip this verifier to keep calls fast.

### Job market data (`data/market/market.json`)
BLS Occupational Outlook Handbook, **2025-35 projections** (pages last modified 2026-08-27), 12 occupations mapped to the 8 majors. BLS publishes 10-year projections, so the **3 and 5 year figures are interpolated and always labeled as estimates**. Retrieved through an automated page summary: verify against the linked pages before quoting externally. Routes come from the TCU catalog.

## Run it

```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY (the engine, courses and market data work without it)
npm run dev                    # http://localhost:3000
npm test                       # 66 tests
```

Without `ANTHROPIC_API_KEY` the app still reads transcripts (rule-based), plans, compares, shows market data and the catalog. The AI features say so plainly instead of failing.
| `ANTHROPIC_WORKSPACE_ID` | Only if Anthropic reports the key "is not scoped to a workspace". Sent as the `anthropic-workspace-id` header |

### Environment
| Variable | Needed for |
|---|---|
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_FAST_MODEL` | Claude features (defaults: `claude-sonnet-5-5`, `claude-haiku-5-5`) |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Persisting advisor requests, feedback, survey, voice conversations (otherwise in memory) |
| `NEXT_PUBLIC_VAPI_PUBLIC_CONFIG` (the Vapi public key), `NEXT_PUBLIC_VAPI_ASSISTANT_CONFIG` (the assistant ID). The older `NEXT_PUBLIC_VAPI_PUBLIC_KEY` / `NEXT_PUBLIC_VAPI_ASSISTANT_ID` names still work | Browser voice calls (public values; Vapi allows these in the browser) |
| `VAPI_SERVER_SECRET` | Authenticates Vapi's server-to-server custom tool requests; never expose it in client code |
| `VAPI_PRIVATE_KEY`, `VAPI_TOOL_CREDENTIAL_ID` | Only for `npm run vapi:sync`, which pushes `vapi/` to the assistant; not needed by the deployed app |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `APP_BASE_URL` | Optional SMS link only; Twilio no longer handles voice |
| `ADVISOR_PASSCODE` | Required to open `/advisor` in production |
| `NEXT_PUBLIC_ADVISOR_SCHEDULING_URL` | Display value |

Never commit real values. `.env.example` holds names only.

### Supabase
The schema is `supabase/migrations/0001_init.sql` (already applied to the *Neeley Ai - Hackton* project). Row-level security is on with **no public policies**: only the server's service role key can read or write.

### Vapi browser voice
The home page uses Vapi's web SDK for browser microphone calls. Vapi handles speech and the call; the assistant's tools call `/api/vapi/tools`, which answers from the same catalog, planning engine and BLS data as the rest of the app. Calls are unauthenticated and can only access general information, not student records.

**The call flow** (`vapi/system-prompt.md`) mirrors the prospect screens: find out who is calling, give an overview of the eight Neeley majors and three minors (`list_education_options`), ask the survey's questions one at a time, rank fits (`fit_programs`), explain a program's courses, skills, routes and job market (`get_program_details`, `get_market_info`), compare two neutrally, help the caller choose, then offer the website's next steps: an advisor call-back saved to Supabase (`request_advisor_callback`), the survey, sample plan, compare page or demo application.

**Tools.** The data tools (`list_education_options`, `get_program_details`, `fit_programs`, `get_market_info`, `get_course`, `search_courses`, `list_programs`, `sample_plan`, `request_advisor_callback`, `send_text_link`) run the deterministic code directly, with no Claude call, so voice turns stay fast and work without `ANTHROPIC_API_KEY`. `neeley_advising_answer` runs the full Claude tool loop with the reply verifier for open-ended questions; its turns are kept in the Supabase `conversations` table. The voice tools' schemas live in `src/lib/ai/tools.ts`; `vapi/assistant.json` is a generated copy checked by `tests/vapi-config.test.ts` (regenerate with `WRITE_VAPI_CONFIG=1 npx vitest run tests/vapi-config.test.ts`).

Setup:
1. In Vapi, create or select an assistant and choose its model and voice.
2. Create a **Public API Key** in Vapi. Restrict it to that assistant and the website origins where the app will run (production, plus any development preview origins you use). In **Replit Secrets** and in Vercel's Environment Variables, add `NEXT_PUBLIC_VAPI_PUBLIC_CONFIG` and `NEXT_PUBLIC_VAPI_ASSISTANT_CONFIG` (named `_CONFIG` so Vercel does not warn about a "key" in a public variable), then redeploy. These are browser values: the public key is intended to be visible to the web SDK.
3. Create a long random shared secret. Add it as `VAPI_SERVER_SECRET` in Replit Secrets and as a server-side Environment Variable in Vercel. In Vapi, create a custom credential that sends that exact secret in an `x-vapi-secret` header, without a Bearer prefix, and note its credential ID.
4. Push the prompt, first message and tools to the assistant from a machine with these set locally (never commit them): `VAPI_PRIVATE_KEY` (a Vapi private key, used only by this script), `NEXT_PUBLIC_VAPI_ASSISTANT_CONFIG`, `APP_BASE_URL` (the deployed https URL) and `VAPI_TOOL_CREDENTIAL_ID` (from step 3; without it the script sends `VAPI_SERVER_SECRET` as a tool header instead). Run `npm run vapi:sync -- --dry-run` to review, then `npm run vapi:sync`. The script keeps the model you chose, replaces the system prompt and the Neeley tools (including a dashboard-made `neeley_advising_answer`), and adds an end-call tool. Rerun it whenever `vapi/` changes.
5. Confirm the assistant has recording disabled unless your privacy and consent requirements permit recording.

To configure the assistant by hand instead, paste `vapi/system-prompt.md` as the system prompt, use `firstMessage` from `vapi/assistant.json`, and create one Function tool per entry in its `tools` list with the server URL `https://<your-vercel-domain>/api/vapi/tools` and the credential from step 3.

**Where the voice data comes from.** The data tools read the catalog, program and BLS market files that ship with the app (`data/`), so they work without Claude credits and without Supabase. Supabase stores only call-back requests, feedback, survey answers and the open-ended tool's conversation history. `/api/vapi/tools` accepts every tool-call shape Vapi sends (`toolCallList` as `{ id, name, arguments }`, OpenAI-style `toolCalls`, and `toolWithToolCallList`).

**If the assistant says it cannot pull data:** (1) the assistant in Vapi does not have the tools yet: run `npm run vapi:sync`; (2) the tool's Server URL or the `x-vapi-secret` credential does not match `VAPI_SERVER_SECRET`: in Vapi's Call Logs, a 401 means the secret is wrong; (3) only `neeley_advising_answer` needs Claude, so low Anthropic credits affect that tool alone.

The shared secret is not a Vapi API key. It is a separate password used only between Vapi and this app's server. Never paste it into chat, source code, or a `NEXT_PUBLIC_` variable.

### Optional Twilio SMS
Twilio is retained only for the existing "text me the sign-in link" action. It requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, and `APP_BASE_URL`. The voice assistant asks for a number and clear consent before sending a text; if SMS is not configured, it tells the caller it could not send the message.

### Deploy (Vercel)
The project is already connected to Vercel. Add only the new Vapi variables to its existing Environment Variables, keep the current Supabase and other settings, then redeploy. The `data/` folder is traced into the serverless functions.

## Data pipeline (`scripts/`)
- `build_catalog.py`: parses the 2,791-page catalog PDF into `data/catalog/courses.json` (about 3,900 courses with descriptions, prerequisites and typical offerings). Catalog pages list each page's course headers first and the descriptions after, so pairing is done **per page** to avoid drift; four mismatched pages (graduate courses) are logged.
- `data/catalog/neeley.json`: majors, minors, Core Curriculum, lower-division and business core, policies, each with a source and catalog page. Hand-structured from the catalog.
- `data/catalog/calendar.json`: the catalog's academic calendar (Fall 2026 to Summer 2027).
- `make_sample_pdf.py`: renders the sanitized sample transcript as a PDF.

Rebuild the catalog with `python3 -m venv .venv && .venv/bin/pip install pypdf && .venv/bin/python scripts/build_catalog.py "<Undergrad Catalog.pdf>"`.

## Tests (`tests/`)
Transcript parsing (text and PDF), prerequisite parsing, availability labels, the engine on the sample student, **mutation tests** (change one fact, expect the right finding), alternatives and comparison, market data, the AI layer with a scripted fake model (tool loop, verifier, profile validation, extraction cross-check), and Vapi tool-endpoint authentication and payload handling.

## Known limits
- No live schedule, so **no meeting-time conflict or seat checks**; the app says so everywhere it matters.
- Catalog year mismatch for the sample (record 2025-26 vs catalog 2026-27) is flagged, not resolved.
- The maximum credit load per term is not in the supplied documents; the plan assumes 15 and says so.
- Double-major, shared-credit and transfer-evaluation rules are not stated in the catalog; these go to an advisor.
- Major "profiles" for prospective-student fit and the career-to-course mapping are **drafts no advisor has reviewed**.
- Login is not wired yet: students load a transcript. Next step: TCU email sign-in (for example Clerk) and an authorized registrar or Stellic feed.
- Real student records need TCU authorization (FERPA) before use.
