# Deployment

## Current status

CGP runs locally. Local Worker, D1, and password-hashing Durable Object configuration lets it run without a Cloudflare account or remote resources. No hosted release, custom-domain route, production database, or release workflow is configured or verified.

Use the [README](../README.md#run-locally) and [local testing guide](LOCAL_TESTING.md). `pnpm dev` and `pnpm preview` run locally. Database scripts explicitly pass `--local`.

## Hosting design

CGP targets Cloudflare Free allowances: static React assets and a Worker API, D1 application data, and a private SQLite-class Durable Object for native scrypt password hashing. The hashing object does not persist user records. Its separate compute boundary avoids putting hashing in an ordinary Worker's short Free CPU budget.

Cloudflare documents [Free SQLite-backed objects and quota behavior](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Durable Object CPU limits](https://developers.cloudflare.com/durable-objects/platform/limits/), and [Worker CPU limits](https://developers.cloudflare.com/workers/platform/limits/#cpu-time). Free quotas are finite; requests and storage operations can fail when an allowance is exhausted. Chat uses polling with slower closed-chat intervals, hidden-document suspension, and failure backoff. This does not imply unlimited free traffic.

Local compatibility does not establish hosted resource usage. Cloudflare's [runtime limits are not enforced locally](https://developers.cloudflare.com/workers/wrangler/configuration/#limits). Verify actual Free-account CPU outcomes, quotas, failure handling, and expected traffic before hosted-release approval.

## Future release requirements

A separately approved release must configure resources, trusted HTTPS origin, cookies, domain routing, schema rollout, recovery, and service limits. Production authentication fails closed without an explicit trusted HTTPS origin. Loopback-only `LOCAL_DEV` behavior must not be enabled for hosting.

| Release requirement | Current evidence and remaining work |
| --- | --- |
| Runtime and bindings | Local Workers, D1 SQLite, and the private SQLite-class hashing object are exercised by integration tests. Create real bindings and the Durable Object class migration only during approved hosting work. |
| Origin and cookies | Local tests cover fail-closed origin handling, Secure host-only cookies, CSRF, and strict production headers. Verify the actual HTTPS origin, cookies, and domain routing on the release. |
| Static assets and headers | Current local configuration runs the Worker before assets so document security headers are applied. Preserve that behavior or implement and verify equivalent asset headers. Worker-first asset requests consume Worker allowance; include them in capacity estimates. |
| Database rollout | Apply every versioned migration explicitly. Test upgrades with existing data, including inbox-counter backfill, in disposable storage first. The one-time backfill scans existing history; plan its rollout against database size and D1 limits. |
| Capacity | Synchronization uses indexed inbox state, atomic unread counters, and a server request limit. Measure actual D1 rows read and written, Worker requests and CPU, and hashing-object load against the expected traffic and account's allowances. Persistent rate counters and chat updates also consume writes. |
| Recovery | Establish backup retention, rehearse restoration, and document migration and application rollback before release. Local persistence does not verify hosted recovery. |
| Security review | Recheck dependencies and scan the exact release revision after production configuration changes. Confirm private-data boundaries and failure handling on the approved hosted test environment. |

D1 has separate [SQL and storage limits](https://developers.cloudflare.com/d1/platform/limits/) and [read/write allowances](https://developers.cloudflare.com/d1/platform/pricing/). The current implementation avoids `LIKE` patterns for player search and bounds synchronization work independently of unread-message history. These local compatibility checks do not establish how many hosted users the application can support.

Review authentication, moderation, localization, accessibility, dependencies, and Codex Security findings against the release revision. Resolve validated vulnerabilities, test migrations with disposable data, and verify restoration and rollback. Add deployable configuration and exact release instructions only with that approved work.

Keep deployment-specific identifiers, credentials, and private operator records outside this public documentation.
