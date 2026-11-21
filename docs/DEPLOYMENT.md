# Deployment

## Current status

CGP 0.1.0 was deployed to Cloudflare on 2026-11-21 using a Worker, static assets, a fresh D1 database, and a private SQLite-class password-hashing Durable Object. A custom HTTPS domain is connected. Deployment was manual; no automatic GitHub build/deploy workflow is configured.

Local Worker, D1, and password-hashing configuration still runs without a Cloudflare account or remote resources. Production configuration and identifiers are retained in ignored operator storage, separate from `wrangler.local.jsonc`. Local users, passwords, messages, and administrator grants were not copied to hosting.

Use the [README](../README.md#run-locally) and [local testing guide](LOCAL_TESTING.md). `pnpm dev` and `pnpm preview` run locally. Database scripts explicitly pass `--local`.

## Hosting design

CGP targets Cloudflare Free allowances: static React assets and a Worker API, D1 application data, and a private SQLite-class Durable Object for native scrypt password hashing. The hashing object does not persist user records. Its separate compute boundary avoids putting hashing in an ordinary Worker's short Free CPU budget.

Cloudflare documents [Free SQLite-backed objects and quota behavior](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Durable Object CPU limits](https://developers.cloudflare.com/durable-objects/platform/limits/), and [Worker CPU limits](https://developers.cloudflare.com/workers/platform/limits/#cpu-time). Free quotas are finite; requests and storage operations can fail when an allowance is exhausted. Chat uses polling with slower closed-chat intervals, hidden-document suspension, and failure backoff. This does not imply unlimited free traffic.

Local compatibility does not establish hosted resource usage. Cloudflare's [runtime limits are not enforced locally](https://developers.cloudflare.com/workers/wrangler/configuration/#limits). Verify actual Free-account CPU outcomes, quotas, failure handling, and expected traffic before hosted-release approval.

## Initial hosted verification

The initial release passed HTTPS page/API health checks and 21 bounded checks using temporary synthetic accounts: native password hashing and verification, Secure host-only HttpOnly sessions, public/private data separation, search, origin and CSRF denial, ordinary-user administrator denial, idempotent chat, unread/read state, blocking, reports, logout, and sign-in. The synthetic accounts and their test records were removed using their exact generated IDs.

Both versioned migrations applied to fresh hosted storage. An initial schema export was restored into isolated local storage and checked for its tables and inbox triggers. This is a fresh-database recovery check, not proof of recovery under an incident or with substantial production history.

The release uses a trusted HTTPS `APP_ORIGIN`, excludes `LOCAL_DEV`, keeps the private hashing binding, and runs the Worker before assets to apply security headers. Public development/preview URLs are disabled. These representative hosted checks do not establish sustained capacity, future quota headroom, long-term reliability, or absence of every vulnerability.

## Subsequent releases and remaining verification

An approved release must preserve the resources, trusted HTTPS origin, cookies, domain routing, schema rollout, recovery, and service limits. Production authentication fails closed without an explicit trusted HTTPS origin. Loopback-only `LOCAL_DEV` behavior must not be enabled for hosting.

| Release requirement | Current evidence and remaining work |
| --- | --- |
| Runtime and bindings | Hosted D1 and private native hashing passed representative flows. Preserve the bindings and SQLite-class migration during updates. |
| Origin and cookies | Hosted checks verified HTTPS responses, Secure host-only cookies, origin/CSRF checks, and strict headers. Recheck after origin, routing, or security-configuration changes. |
| Static assets and headers | Both local and hosted configurations run the Worker before assets. Preserve that behavior or verify equivalent asset headers. Worker-first asset requests consume Worker allowance; include them in capacity estimates. |
| Database rollout | Both current migrations applied to fresh hosted storage; local integration tests cover an existing-data upgrade. Test later upgrades with disposable copies first. Plan large backfills against D1 limits. |
| Capacity | Synchronization uses indexed inbox state, atomic counters, and a server limit. Representative flows passed; sustained load and realistic usage capacity remain unverified. Include rate-counter and chat writes in estimates. |
| Recovery | An initial schema export/isolated restore passed. Establish retention, rehearse recovery with representative data, and document revision-specific rollback before updates. |
| Security review | Existing source review and hosted smoke checks cover different evidence. Run dependency checks and Codex Security after implementation changes, and confirm changed security boundaries on the approved hosted environment. |

D1 has separate [SQL and storage limits](https://developers.cloudflare.com/d1/platform/limits/) and [read/write allowances](https://developers.cloudflare.com/d1/platform/pricing/). The current implementation avoids `LIKE` patterns for player search and bounds synchronization work independently of unread-message history. These local compatibility checks do not establish how many hosted users the application can support.

## Operator workflow

Build with `pnpm build`. Use a separately maintained production configuration pointing to the generated Worker bundle and client assets, with real bindings, the exact trusted HTTPS origin, `LOCAL_DEV` absent, and existing domain settings preserved. Never deploy `wrangler.local.jsonc` or its generated local configuration directly.

For the initial operator setup, the ignored production file is `.wrangler/release/wrangler.json`. After reviewing that file and confirming the intended account, resource IDs, domain configuration, and revision, use `pnpm exec wrangler deploy --config .wrangler/release/wrangler.json`. Hosted migrations require explicit `--remote` and the production configuration; ordinary `pnpm db:migrate` and `pnpm db:sql` remain local-only. Database exports and credentials must also remain ignored.

Cloudflare's official Wrangler tool needs the deployment-specific Workers Scripts permission and D1 write access, along with required account/user information. The general Workers permission alone was insufficient for deployment. Use protected operating-system credential storage where available and remove the local sign-in with `pnpm exec wrangler logout` after a temporary deployment session. Review any new permission request before authorizing it.

Review authentication, moderation, localization, accessibility, dependencies, and Codex Security findings against each release revision. Resolve validated vulnerabilities, test migrations with disposable data, and verify restoration and rollback. Record what was actually tested separately from unverified behavior.

Keep deployment-specific identifiers, credentials, and private operator records outside this public documentation.

## Hosted administrator access

The hosted database starts without seeded accounts or administrators. Register an account through the hosted interface first. After explicitly authorizing an operator session and verifying the production configuration, find its immutable ID:

```sh
pnpm exec wrangler d1 execute cgp --remote --config .wrangler/release/wrangler.json --command "SELECT id, username, is_admin FROM users WHERE username = '<USERNAME>';"
```

Replace `<USER_ID>` with that exact ID to grant access:

```sh
pnpm exec wrangler d1 execute cgp --remote --config .wrangler/release/wrangler.json --command "UPDATE users SET is_admin = 1 WHERE id = '<USER_ID>';"
```

To revoke access, use the same command with `is_admin = 0`. Confirm the next administrator request is denied after revocation. These commands deliberately target hosting; the similarly named `pnpm db:sql` command targets local development only. Never add a role-editing API or promote users automatically.
