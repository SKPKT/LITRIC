# LITRIC backend security review

Scope: source review and local built-Worker tests, 21 October 2026. This is not a penetration test or a guarantee of production readiness. Production authentication, storage administration and deployed browser behavior require the final acceptance checks in DEPLOYMENT.md.

| Control | Finding |
|---|---|
| Student data at rest | Existing D1/R2 remain private. No database/table/record identifiers or backup format were renamed. No migration or deletion is required. |
| Public source | A separate export starts without private Git history and replaces the private seed with `[]`. Source checks reject original pupil identifiers and private inputs. Never publish the private original checkout/history. |
| Public build | Dedicated Vite entry imports client modules only. Automated checks reject seed/server identifiers, original pupil identities, server artifacts and source maps in `dist-pages`. |
| Authentication | Sites supplies trusted identity headers. APIs reject missing identity (401); school invitations and active-user state are checked. Never expose the Worker directly behind a proxy that permits client-supplied identity headers. |
| Admin bootstrap | Runtime-only `LITRIC_ADMIN_EMAIL`, with existing `LITRIX_ADMIN_EMAIL` fallback. Existing account IDs and invitations are preserved. Local simulated owner is restricted to loopback and the known development identity. |
| Server RBAC | Every API authenticates. Imports require admin; teachers are limited by school/class, pupils by canonical own identity. Reports, original sources, evidence, backup and certificate verification are protected. Invited aggregate-display role has no pupil-level data access. |
| Origin/CORS | All API requests with a foreign Origin are rejected. No permissive CORS headers. Mutations remain same-origin in the authenticated backend window. |
| Pages connection | Exact parent origin, backend origin, peer window, channel and protocol validation. Endpoint/method allowlists; no arbitrary URL/headers/cookies/authorization forwarding. Request IDs resist replay in the active window. JSON/form/response sizes and concurrent requests are bounded in the bridge. |
| Browser state | Authorized data stays in React memory. No student data/tokens in localStorage, IndexedDB, a service worker or the static HTML. Only theme preference is stored; the legacy theme key is read for compatibility. Frontend state is cleared on connection closure or unauthenticated state response. |
| Exports/cache | API JSON and downloads use `private, no-store` and `nosniff`. PDF/XLSX generation and QR verification recheck permissions server-side. Certificate QR points at the protected backend, preserving old links. |
| Audit | Existing sensitive mutations/imports/identity changes/user management/backup retain server audit logs. Original source provenance and reversible import/merge behavior remain intact. |
| Data correctness | Annual/year boundaries, cumulative snapshot replacement, overlapping scopes, event registry, duplicates, reversibility and separate AINS/local school activities remain tested. Rules are not silently recertified. |
| SMARTLIB | Server-only secret, configured HTTPS adapter, redirects refused. Connection is not assumed. Camera/real catalog need school-device testing. |

## Material limits and smallest follow-up changes

- The new backend bridge and public frontend have **not been deployed**; the user requested code/configuration first after the GitHub 404. Full browser authentication/bridge behavior is unverified. Keep using the existing private app until acceptance passes.
- All `skpkt.github.io` projects share an origin. Keep them under trusted school control, or move the frontend to a dedicated school origin and update the explicit allowlist before hosting untrusted content elsewhere on the account.
- Existing authentication relies on Sites dispatch stripping/overwriting identity headers. Moving to another backend host requires verified session/token middleware before those headers can be trusted. Reusing the database alone is insufficient.
- Large-school scalability, rate limiting, operational monitoring, retention and scheduled database/R2 backups need operator configuration. Existing single-school limits remain; do not assume this source review establishes capacity or uptime.
- Public repository administration, branch/environment protection, production secret values and cloud storage ACLs could not be audited through the unavailable target repository. Keep tokens out of future workflow logs and artifacts.
- The bridge returns only authorized data, but a compromised script on the trusted frontend origin can read what that signed-in user can read. Standard frontend supply-chain/XSS controls and protected reviews remain necessary.
