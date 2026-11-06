# SMARTLIB Agent: Cloud recovery and deployment plan

Prepared 6 November 2026 for **SK Pendidikan Khas Taiping / ABA6052**.

This release recovers the Agent UI and independent verified-import AINS analysis.
**SMARTLIB Integration: NOT VERIFIED** remains visible; catalogue, availability
and circulation stay disabled. An AINS-only UI release is permitted after the
existing Cloudflare configuration and bindings are reconciled. The earlier
verification reports are historical; their broader integration deployment gates
do not supersede this explicitly requested disabled-catalogue release.

## Source recovery

GitHub inspection found only these branches:

| Branch | Head at inspection | Agent/robot code |
| --- | --- | --- |
| `main` | `d13ed71f66333148f69019fba84e21225f6856f8` | Absent; older Pages/Sites implementation |
| `feat/litric-v2-standalone` | `bbd9521be34610ddc5c288dd0c39ca93b54e4b63` | Absent; working V2 baseline |

[V2 PR #1](https://github.com/SKPKT/LITRIC/pull/1) remains open, draft and
unmerged. Its head/base are unchanged. The Agent PR is stacked on that V2 branch
so its diff does not duplicate the entire V2 implementation.

The attached Cloud filesystem actually contained the earlier uncommitted patch.
Recovery was based on observed files, not an assumption that a separate desktop
is accessible. These recovered source files were missing from GitHub:

- `app/modules/smartlib-agent.tsx`
- `app/modules/smartlib-agent.css`
- `app/modules/smartlib-connection.tsx`
- `lib/smartlib-agent.mjs`
- `lib/smartlib-status.mjs`
- `tests/smartlib-agent.test.mjs`
- `tests/smartlib-status.test.mjs`

Recovered edits to the API route, dashboard, catalogue view, Worker allowlist,
theme and integration tests were also absent remotely. Earlier redacted
verification reports were recovered. Cloud continuation adds a portable browser
test, pinned QA dependencies, CI for PRs targeting V2, a production comparison
and this plan. Once pushed, no desktop workspace is required to resume.

## Resulting behavior

- Four main modules remain: Dashboard Analitik, Import Data AINS, Pengurusan
  Murid and Pencapaian Bintang NILAM. Agent is a dashboard subtab.
- The white/lavender CSS 3D robot has request-driven Standby, Analyzing and
  Completed states and reduced-motion support. Completed refers to an AINS
  request, not SMARTLIB integration success.
- Questions use authenticated school/class-scoped server reads. Calculations and
  rules operate on verified imports; a generative model is not configured or
  simulated. Questions and pupil data are not sent to an external model.
- AINS analysis distinguishes missing entries, zero approved readings, missing
  coverage and unresolved subperiods of annual summaries. It shows the latest
  verified reporting date, without substituting import time.
- Missing AINS entries do not prove a pupil has not read. Follow-up drafts
  suggest teacher review, assisted reading and suitable formats without inferring
  diagnosis, ability or interests.
- A teacher must acknowledge reviewing the evidence before marking a draft as
  reviewed. This review is explicitly **session-only**, resets with a new
  analysis/period and is not a persisted approval or a new programme record.
- Catalogue/availability/overdue sections remain unavailable. No fake books,
  loans, counts or connection/sync/verification timestamps are returned.
- No SMARTLIB credential is sent to an unverified URL. No connector, public
  unauthenticated data endpoint or SMARTLIB write action is enabled.
- No schema migration is introduced. Auth code, cumulative NILAM engine,
  identity rules, schema and checked-in Worker bindings remain unchanged from
  V2. Agent questions/reviews do not write pupil or reading data.

## Comparison with current production

See [the redacted observation manifest](SMARTLIB_AGENT_CLOUD_BASELINE.json) for
timestamps and frontend digests. Public observations and candidate tests:

| Endpoint | Existing production | Candidate |
| --- | --- | --- |
| `/` | 200; referenced frontend asset lacks Agent | Agent and robot render locally |
| `/health` | 200, `ok=true`, `loginEnabled=true` | Existing behavior preserved |
| `/api/state` without session | 401 | 401 |
| `/api/smartlib/status` without session | 404 | 401 |
| `/api/smartlib/agent` | GET 404; route absent | Protected POST; unauthenticated POST 401 |

The candidate frontend digest differs and includes the Agent route and robot
markup. This does not establish the live server's source SHA. The actual live
Worker version, D1 ID and runtime bindings are **not reconciled**; public health
does not expose them. The user reports working GPM login. No real password was
requested, tested or changed; browser QA uses a generated local account.

## Validation and Cloud reproduction

```sh
npm ci --include=dev --include=optional
npm run check:public
npm test
npm run typecheck
npm run build:cloudflare
node scripts/check-pages.mjs --worker
npm run build:api
npm run test:api
npm run test:agent:browser
git diff --check
```

Browser QA requires installed Chrome/Chromium. Set `LITRIC_BROWSER_EXECUTABLE`
when needed. It launches an isolated local Worker and uses synthetic AINS data,
never catalogue fixtures or mocked API responses. `LITRIC_QA_ARTIFACTS` optionally
selects an output directory; the default is outside the repository in temp.

Local results:

- Unit suite: 15 files reported, zero failures; TypeScript and builds pass.
- Worker build is dry-run packaging, not a deployment. Source/frontend privacy
  scans pass.
- **191 isolated Worker/D1 checks pass**, including authorization, class scope,
  request limits and unchanged data-row hashes. Existing three-year 400 readings,
  2 stars and 32 remaining regression checks still pass.
- Browser QA passes: local login and actual API responses, three robot states,
  explicit teacher review, review reset and unchanged synthetic AINS rows.
- Widths 1440, 768, 390 and 320 px: no horizontal overflow. Reduced motion and
  keyboard tabs pass. Scoped axe WCAG 2/2.1 A/AA scans pass at all four widths in
  light theme and at 320 px in dark theme. Zero external browser requests and
  browser JavaScript errors. These are viewport tests, not physical-device tests
  or full accessibility certification.

The workflow now validates PRs targeting V2 as well as main and uploads browser
evidence. Its deploy job is still gated to main and cannot run for a PR. A new
feature branch push is not a main-branch deployment.

## Exact deployment blocker

`wrangler whoami` explicitly reports **not authenticated**. No Cloudflare
credential/identity binding is configured here. GitHub write access is available;
it does not authorize Cloudflare.

The reconciled generated Wrangler config is absent. The tracked template uses
`litric-api` with the all-zero D1 placeholder; production is `litric-pilot`.
Deploying that template would target the wrong configuration. The actual
existing D1 ID, Durable Object namespace, current Worker version, variables and
bindings must be read from the authorized school account, not guessed from
names or replaced with new resources.

**No production deployment was attempted.** No bootstrap, database creation,
remote migration, D1 write, secret change, merge or force push was performed.

## Safe release plan

1. Authorize the school Cloudflare account through secure Cloud environment
   credentials, or configure the authorized GitHub production environment. Do
   not paste tokens in chat or source. Direct deployment from Codex Cloud is
   technically possible after authorization; a desktop PC is not required.
2. Read the current `litric-pilot` Worker deployment/settings. Record its version
   for rollback and verify the existing origin is
   `https://litric-pilot.g-18197853.workers.dev`.
3. Reconcile an ignored generated config: same Worker/account, actual existing
   D1 ID/`DB` binding, same `SCHOOL_SERVICE` Durable Object/class/namespace and
   migration tag, auth mode, frontend origin, asset behavior and existing
   secrets. Preserve runtime variables rather than overwriting them from a
   template. Halt on any mismatch.
4. Keep private pre-release comparisons appropriate to school policy. Verify the
   schema already matches V2. This feature has no schema change: do not create a
   database, rerun GPM bootstrap, change its password or run migrations for this
   UI-only release.
5. Review the stacked Agent PR and PR #1 in dependency order. Do not merge
   automatically. Reconcile any newer V2 changes and validate the exact release
   commit. A direct release need not merge main, but must use reviewed source
   and the reconciled existing Worker config.
6. Deploy only that source/build to the existing Worker, keeping SMARTLIB NOT
   VERIFIED. The existing generic main workflow includes a migration step: use
   a reviewed no-migration release path rather than enabling it blindly.
7. Verify health, new protected endpoint rejection without a session, existing
   GPM login via a school-authorized session, all four modules, historical
   AINS/NILAM comparisons, Agent and robot. Catalogue/loan questions must remain
   unavailable. Loans must never increment NILAM totals.
8. On application failure, roll back only the Worker to its recorded prior
   version. Do not replace or restore live D1 as a code rollback.

Verified SMARTLIB source/version binding and least-privilege service access are
separate future catalogue activation gates. They are not prerequisites for this
explicitly requested disabled-catalogue AINS-only UI release.
