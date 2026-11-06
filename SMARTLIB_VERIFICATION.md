# SMARTLIB Integration: NOT VERIFIED

Verification report: **2026-11-06 12:13:28 UTC** (20:13:28 MYT).

The authenticated live integration step is stopped. No deployment was made.
An accessible frontend, public ping, candidate spreadsheet or passing local test
does not establish a verified SMARTLIB data connection.

## Operational source and production linkage

- The owner confirmed the operational frontend: https://skpkt.github.io/smartlib/.
- Current repository: https://github.com/SKPKT/smartlib, main commit
  `c3adbdc6eb5d572d058764e098fd9fd3b9ba8623`.
- The live frontend returned HTTP 200 and exactly matched the repository's
  `index.html`. SHA-256:
  `f5981b23b471ef42c256e6427eb6547b379297ba1050872643dc1e7e4897430b`.
- Both name this Apps Script deployment:
  https://script.google.com/macros/s/AKfycbx7rWTKKzkIywz93hVKXV_BF-CNz9CR8KC-AXFIUynTk-yof3VPLB27sXm2A66e4lvR/exec.
- This proves which endpoint the confirmed production frontend references.
  It does **not** prove the deployed Apps Script source version, spreadsheet
  binding, service authentication contract, or backend authorization scopes.
- No Apps Script backend source is in the current SMARTLIB repository. The
  accessible Drive search returned no Apps Script projects. The editor project
  URL and authorized deployed-source inspection are still required.
- An authorized Drive search found a candidate acquisition spreadsheet ending
  `...Ns7U`, last modified 2026-11-04. Metadata includes acquisition, loans,
  disposal and other operational tabs. Only two catalogue rows and the loan
  header were read. No member rows, sessions, administrator credentials or loan
  borrower details were read. **Its binding to the production deployment is
  unproven.** Grid capacity is not a catalogue record count.
- Old SMARTLIB backup documents were not used as production evidence.

## Verified and unverified API capabilities

The current frontend uses Apps Script action requests and a `sessionToken`.
Catalogue fields in the candidate Sheet include `id`, `judul`, `pengarang`,
`isbn`, `no_panggilan` and `status`. Loan headers include `id`, `buku_id`,
`tarikh_pinjam`, `tarikh_patut`, `tarikh_pulang` and `status`, alongside borrower
references. Frontend logic treats `status=pinjam` as active and compares the
current date with `tarikh_patut` for overdue status. These observations are
schema/implementation evidence, not authenticated live capability tests.

The previous LITRIC adapter expected `books[].title` and optionally a bearer
header. That is not the demonstrated SMARTLIB action/session format. Guessing
an adapter or reusing a full administrator session would not verify a secure
read-only service identity.

| Required test | Actual result |
| --- | --- |
| Production source identified | Frontend confirmed by owner; live file matches current repository |
| Backend endpoint reachable | GET `action=ping`: HTTP 200, JSON `ok=true`, at 12:08:28 UTC |
| Unauthorized protected read rejected | GET `action=baca_semua`, no token: HTTP 200 with JSON `ok=false`, authentication rejection, no data, at 12:08:30 UTC |
| Authenticated read-only service connection | **BLOCKED:** dedicated service credential and deployed authorization contract unavailable |
| Real catalogue retrieval through LITRIC | **NOT RUN / NOT VERIFIED** |
| Catalogue ID/title traced to deployed SMARTLIB backend | **NOT VERIFIED:** two real candidate Sheet entries were inspected through Drive only; no backend cross-check |
| Search by title, author, ISBN and DDC | **NOT RUN / NOT VERIFIED** |
| Availability from active loans and returns | **NOT RUN / NOT VERIFIED** |
| Current borrowing and return records | **NOT RUN / NOT VERIFIED:** header inspection is not record validation |
| Overdue calculation from actual dates/return state | **NOT RUN / NOT VERIFIED** |
| Invalid service credential rejection | **NOT RUN:** no verified service authentication mechanism |
| Freshness / missing data | No verified catalogue sync or data timestamps; count and success times remain unknown |
| No nonexistent recommendations | Local guard returns no unverified catalogue recommendations; live recommendation correctness remains unverified |
| No SMARTLIB writes | No create, update, delete, reservation, loan or return action was issued; probes used GET only and Drive access was read-only |

The public ping and missing-token rejection are the only live SMARTLIB API
tests performed. No successful authenticated request is claimed. HTTP 200 with
`ok=false` is an application-level rejection, not an HTTP 401/403.

## Local LITRIC safety changes

Prepared against `feat/litric-v2-standalone`, base commit
`bbd9521be34610ddc5c288dd0c39ca93b54e4b63`:

- Added a SMARTLIB Connection panel on the existing staff dashboard and catalogue
  view, without adding a fifth main module.
- Added an authenticated, staff-only, no-store `/api/smartlib/status` endpoint.
- Missing URL/credential returns Not Configured. Having both still returns
  Disconnected with `verified=false`; neither proves authorized catalogue access.
- Successful data connection time, catalogue sync time and catalogue record count
  remain null/unknown. A status check does not populate them.
- Added labels for all four requested states. Actual Connected and Stale Data
  transitions, synchronization and persistence are **not implemented**, because
  the real authenticated connector contract and freshness semantics are blocked.
- Removed the adapter's unsupported `connected: true` response and generated
  fallback book IDs. Catalogue requests now stop with HTTP 409, an empty list,
  `connected=false` and the exact NOT VERIFIED message, without contacting an
  unverified configurable destination or transmitting its credential.
- Withheld unverified legacy recommendation links in the catalogue UI. Existing
  stored links were not deleted. Failed searches clear previous search results.
- The standalone Worker previously did not expose SMARTLIB routes. Its GET
  allowlist now includes only the guarded catalogue and status reads. SMARTLIB
  POST requests remain rejected; no SMARTLIB write route was added.
- No schema migration, database replacement, production D1 operation, GPM login
  change, production secret change, GitHub push or application deployment occurred.

These changes are an **undeployed safety patch**, not a completed integration.

## Local validation

All results below concern local code and isolated test data, not live SMARTLIB:

- `npm test`: passed (14 test files reported, zero failures).
- `npm run typecheck`: passed.
- `npm run build:cloudflare`: passed, including the standalone privacy scan.
- `npm run build:api`: passed as a dry run; no upload/deployment performed.
- `npm run check:public`: passed; no private seed inputs, credentials or private
  application emails in the source scan.
- `npm run test:api`: **168 isolated Worker/D1 checks passed**, covering the
  existing authentication, school scope, imports, reporting and preservation
  scenarios plus the guarded SMARTLIB routes. New checks verify unauthenticated
  status/catalogue rejection, unverified empty results, null evidence fields,
  staff status access and rejection of SMARTLIB POST requests.
- Status unit tests verify that even a configured URL, a credential and forged
  success fields cannot produce verified status or leak the supplied credential
  or destination URL. These use synthetic configuration only, not book fixtures.
- `git diff --check`: passed.

The first integration-test attempt could not bind a local loopback port under
the default sandbox. The permitted network-enabled local test rerun passed.
No browser/device validation of the new panel was performed. Frontend compilation
is not presented as browser or live-integration proof.

## Exact blockers and next actions

1. Supply the production Apps Script **editor project URL** and authorize access
   to its deployed source/version. Confirm the spreadsheet ID used by that
   deployment; the discovered candidate is not sufficient proof.
2. Provision a dedicated, least-privilege **read-only service identity** securely.
   Do not paste credentials into chat or put them into client assets, source or
   query strings. The mechanism must be verified against the actual backend;
   bearer-header support must not be assumed for Apps Script.
3. Verify the deployed catalogue/circulation read actions, pagination, school
   scope, identifier mapping, return states, date/timezone and freshness fields.
   Confirm that the authorized identity cannot execute write actions without
   attempting any destructive production operation.
4. Implement the real server-to-server connector using that verified contract.
   Perform the required authenticated reads, catalogue/loan/return cross-checks,
   genuine record trace, missing/stale data checks and service authorization
   tests. Keep evidence redacted.
5. Only after those security and functional checks pass, deploy using the existing
   LITRIC Worker/D1 bindings and verify its authenticated status panel. Preserve
   GPM login and all four modules. No new or replacement database is required by
   this safety patch.

Until these blockers are resolved: **SMARTLIB Integration: NOT VERIFIED**.
