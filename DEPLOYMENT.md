# LITRIC deployment

Literacy Intelligence for Tracking, Reporting, Insights & Competency
Every Read Counts. Every Progress Matters.

## Current result — 21 October 2026

LITRIC is published at **https://skpkt.github.io/LITRIC/**. The repository exists, authorized GitHub access was verified as `SKPKT` with admin/push permission, and the owner explicitly authorized changing this newly created repository from Private to Public. Only sanitized source was committed; the private original Git history and pupil datasets were excluded.

Repository: <https://github.com/SKPKT/LITRIC>
Verified Pages URL: <https://skpkt.github.io/LITRIC/>
Successful Actions run: <https://github.com/SKPKT/LITRIC/actions/runs/39557357386>

The first attempt was blocked because GitHub Pages was unavailable for a private repository on the account's plan. After the owner's explicit visibility choice, Pages was enabled with `build_type: workflow` and HTTPS, and the rerun succeeded. Tests, privacy guard, TypeScript, static build, artifact upload, deployment and the live HTTP check all passed on GitHub Actions.

The updated private backend is live at <https://litrix-taiping.tender-eft-9384.chatgpt.site>. Its URL and audience remain unchanged for compatibility, and its title/application brand is LITRIC. Backend deployment `appgdep_6ad8608876dc8191a46cd379b6ddefd8` succeeded from private source `5386f3ab6b206a8969e0084fc273c6d04a57f3d4`, with runtime environment revision 1 and the existing D1/R2 bindings. No schema migration or deletion was introduced.

The Pages login button was exercised in the browser with an existing authorized administrator session: the private connection succeeded and the real LITRIC dashboard loaded through Pages. SMARTLIB's page correctly remained unconfigured. Real-device mobile/tablet, fresh-account OAuth, session-expiry and separate-role acceptance testing remain outstanding; local API/unit role tests are recorded in VALIDATION.md.

## Build separation

The original application is React 19 with Vinext/Vite on a Cloudflare Worker, using D1 and R2. It contains real API routes and server authorization. GitHub Pages serves static files only.

`npm run build` produces the private Worker application in `dist/`.
`npm run build:pages` produces the **same React application** as a browser frontend in `dist-pages/` using `vite.pages.config.ts` and `frontend/main.tsx`.

The Pages base is exactly `/LITRIC/`. Existing module routes use hashes, for example `/LITRIC/#/murid` and `/LITRIC/#/profil/<id>`, so refreshing them requests the existing index. `404.html` provides a return link and repairs accidentally shared extensionless module paths. CSS and font asset URLs are rewritten by Vite. No server bundle, source dataset or source map belongs in the Pages artifact.

## Prepare safe GitHub source

The private original checkout contains school source files and private Git history. **Never push that checkout or its history to a public repository.**

The supplied `LITRIC` folder/ZIP is the sanitized export: `lib/seed-data.json` is `[]`, environment files, original datasets, local databases, generated reports, build directories and Git history are excluded. No school records are deleted from the private app. Its original source bootstrap remains available only in the private checkout.

To regenerate the public source after private edits, use a new empty destination:

```sh
npm run export:public -- ../LITRIC-public-new
```

This exports current source without Git history, replaces the private seed with an empty array, checks original pupil names/identifiers against exported text, and runs the public-source guard. Initialize a new Git history **inside the sanitized folder**, or copy it into a checkout of the target repository after inspecting that repository's existing files. Preserve existing repository work; do not force-push.

```sh
npm ci --include=dev --include=optional
npm run check:public
npm test
npm run typecheck
npm run build:pages
```

Only `dist-pages/` is uploaded by `.github/workflows/deploy.yml`. The guard deliberately fails in the private checkout while actual source data is present.

## Private backend update — before enabling Pages data access

Publish the updated private Worker to the **existing Sites project** in `.openai/hosting.json`, using the supported Sites source/version/deployment workflow. Retain D1/R2 bindings, Site owner/audience, and identity integration. No schema changes are needed. Do not repoint the database to an empty database, or deploy an unprotected Worker URL that accepts identity headers from the Internet.

Existing `LITRIX_ADMIN_EMAIL` remains a server-side legacy alias. `LITRIC_ADMIN_EMAIL` is preferred for new installations; if both are set, the new key wins. Do not change the configured owner accidentally. No secret belongs in GitHub variables prefixed `VITE_`, frontend code, a manifest or the Pages build.

The `/bridge` route in the updated backend is required by the Pages frontend. It is deployed in the verified private backend version above. Keep the existing private version available as a restore point. Production source restore point: `20e9ee978a6673a2bbc42f7416d86d59bc020754`; the local private backup/tag `litrix-before-litric-20261021` preserves the original code. This is a source restore point, not a fresh production database backup. Export a current authorized database/R2 backup before a future production migration.

## Browser authentication connection

The existing Sites identity/session belongs to its backend origin. A GitHub Pages origin cannot safely impersonate it or receive an embedded shared token.

The Pages login button opens the private backend `/bridge` in a separate top-level window. The user signs in with ChatGPT there. The connection sends request/response messages using exact origin, window-reference, protocol and random-channel checks. The backend window performs **same-origin** API calls, so each operation still passes Sites authentication and application RBAC. JSON imports, evidence uploads, authenticated images and PDF/XLSX downloads use this connection. No session token or cookie is copied to Pages. Only in-memory authorized application data is returned to the signed-in user's Pages window.

Allowed production parent origin: `https://skpkt.github.io`. The backend rejects cross-origin API calls and does not send `Access-Control-Allow-Origin: *`. The bridge is an explicit message channel, not an open CORS proxy; only enumerated application endpoints and GET/POST are accepted. Local QA permits `http://127.0.0.1:4173`/`http://localhost:4173` only against another loopback backend.

Keep the backend window open while using Pages. Closing it or receiving a 401 clears frontend state. Logging out closes the connection and navigates to the backend's real sign-out endpoint. Some mobile browsers or OAuth cross-window policies may sever `window.opener`; return to Pages and connect again after signing in. The direct private-backend link remains available. The connection was verified using an existing administrator browser session. Fresh-login OAuth and mobile cross-window behavior still need acceptance testing on school devices.

All repositories under `skpkt.github.io` share one web origin. Every script hosted by that account must therefore be trusted. A dedicated school-controlled frontend origin is the smallest next improvement if unrelated/untrusted websites are later hosted under that account. Do not weaken origin checks to `*` to solve connection problems.

## Reproduce GitHub setup or update the deployment

1. Verify `SKPKT/LITRIC` exists and the connected account can push reviewed source and workflows. Inspect existing contents and branch rules.
2. Configure `main` branch protection/rulesets to require reviewed pull requests and the successful build check. The workflow validates pull requests and deploys pushes to `main`; review requirements must be enforced in repository settings.
3. In **Settings → Pages**, select **GitHub Actions**. Configure the `github-pages` environment to allow `main` and any required reviewer approval. Repository-admin access was verified for the authorized Pages setup; the generated github-pages environment restricts deployment to main. Additional reviewer requirements remain an operator choice.
4. Commit the sanitized source with `.github/workflows/deploy.yml` and merge approved changes to `main`.
5. The build installs locked dependencies, checks privacy, runs tests/type checking, builds `/LITRIC/`, and uploads `dist-pages`. The deploy job requests only Pages/OIDC permissions, uses supported official Pages actions, and HTTP-checks the deployment action's returned URL. Failures create Actions errors and job-summary entries; no notification messages are sent externally.
6. Inspect the actual workflow/deployment result, then open its returned URL. Do not describe the target URL as live before those checks pass.

## Acceptance checks after publishing

Use an authorized school administrator and separate teacher/student accounts to test login, dashboard, import and repeated import, profiles, year/class filters, star boundaries, PDF/XLSX reports, certificate QR, evidence uploads/images, log out and session expiry. Verify a signed-out public visitor sees no pupil information and cannot download a protected report. Test Android/iOS tablet/mobile popups, responsive layout, keyboard focus, reduced motion, and refresh of hash routes through the actual Pages URL. Verify origin/window/channel forgery remains rejected.

SMARTLIB still requires its actual URL/credentials and catalog contract. Supplied NILAM/PAJSK rules remain configurable and unverified against current official policy; this migration does not certify them.

Technical references: [GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [Vite static deployment](https://vite.dev/guide/static-deploy.html).
