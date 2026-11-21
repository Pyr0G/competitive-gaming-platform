# CGP architecture

## Runtime and source boundaries

CGP consists of a React and TypeScript interface, a Hono Worker API, and SQLite application data through D1. Vite and the Cloudflare plugin run the interface and API on one local origin. Version 0.1.0 is also deployed using hosted Workers, D1, and the private hashing Durable Object. Local and hosted bindings are separate; production configuration is maintained outside version control.

| Area | Responsibility |
| --- | --- |
| `src/main.tsx` | React entry point |
| `src/app/` | Application shell, session and chat providers, shared contexts |
| `src/features/` | Accounts, administration, chat, Guide, public players, and search |
| `src/components/` | Reusable interface controls |
| `src/lib/` | Shared API client |
| `src/i18n/` | English and Polish catalogs, preferences, and locale formatting |
| `src/styles/` | Centralized CSS, fonts, design tokens, and responsive layouts |
| `worker/` | Validation, authentication, authorization, accounts, search, chat, reports, moderation, and password hashing |
| `shared/contracts.ts` | Public response types shared by the interface and API |
| `migrations/` | Explicit, versioned SQLite schema changes |
| `wrangler.local.jsonc` | Local Worker, D1, assets, and private Durable Object bindings |

Shared CSS defines colors, fonts, spacing, surfaces, controls, and responsive layouts. Application copy and accessible labels use shared English and Polish catalogs with English fallback. Language, region, and time zone are distinct preferences; dates and numbers use `Intl` formatting. Timestamps are stored in UTC.

Language and region controls show bundled SVG flags with text labels. The shared picker supports keyboard navigation, type-ahead selection, and native popover dismissal. Flags are served locally from `public/flags/`, with the [flag-icons redistribution notice](../public/flags/LICENSE.txt). No external flag service is used. Time-zone selection remains a native browser control.

The public `/guide` route presents six numbered sections using React components in `src/features/guide/`, shared styles in `src/styles/guide.css`, and English/Polish catalogs. Sample rosters, schedules, brackets, standings, and maps are separate from account, search, and chat records. A strictly validated FACEIT-shaped link triggers a bounded, cancellable simulation: the example score, winner, bracket, and standings update only in page memory. No URL is fetched and no result is saved. Listing and conversation dialogs are previews, while the final account link opens the real account flow. Leaving or reloading the Guide clears sample changes.

The How it works tutorial cycles through four example screens every seven seconds while visible, with pause controls, hover/focus suspension, and reduced-motion support. Sample countdowns pause outside the viewport and in hidden tabs. Veto auto-complete and result checks have bounded timers that are cancelled on reset, navigation, or unmount.

CGP's logo images and favicon are stored in `public/brand/`; four card images are stored in `public/guide/`. The shared `BrandLogo` component selects the wordmark, compact mark, or full logo; sizing stays in centralized CSS.

## Authentication and private data

Registration creates an active account using username, email, password, and confirmation. The API validates Unicode usernames, normalizes uniqueness keys, and validates preferences. Email remains private, read-only in the interface, and unverified until email integration exists. Password recovery is unavailable.

The private `PasswordHasher` Durable Object uses native `node:crypto` scrypt with a random salt and fixed parameters: `N=16384`, `r=8`, `p=5`, a 32-byte output, and a 32 MiB memory ceiling. This matches an [OWASP scrypt configuration](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt) and avoids a separate hashing dependency. The object uses the SQLite storage class for Free-plan compatibility and does not persist application records. D1 stores password hashes and parameters.

Sessions use random tokens in HttpOnly, SameSite cookies. D1 stores token hashes, CSRF tokens, owners, and expiry timestamps. Sessions expire after seven days; issuance removes a bounded number of expired sessions and caps an account at 20 sessions. Logout revokes the current session. Password changes recheck the current password and revoke all sessions. Bans revoke target sessions. Each authenticated request reads current account and administrator status from SQLite.

All writes require the trusted same origin. Authenticated writes also require the session's CSRF token. The API validates JSON shape and body size, uses prepared SQL, limits sensitive requests in SQLite, and returns stable error codes without database errors or stack traces. Production cookies are Secure; HTTP cookies require explicit loopback development. Production fails closed without a trusted HTTPS origin.

Public player responses contain only ID, username, bio, and join date. The account response adds the owner's email, language, locale, time zone, and administrator flag. Search returns non-banned players; future entity categories expose availability rather than demonstration records.

Player search uses bound literal substring queries on normalized usernames, including Unicode and SQL pattern characters. It avoids D1's small `LIKE` pattern limit while retaining bounded input and cursor pagination.

## Chat and moderation

One conversation exists per unordered pair of different players. Every conversation read and write checks participation. Text messages have a 2,000-character limit and render as text. A client-generated identifier makes retries idempotent within a conversation and sender. Earlier history is paginated; read positions and unread counts persist.

Blocking prevents sending in both directions. A player may report a received message from their own conversation. A report captures that message and up to five preceding messages. Authorized administrators can review this bounded evidence; no administrator endpoint browses arbitrary chat history. Messages are stored as server-readable text; chat is not end-to-end encrypted.

The administrator API searches users, bans or unbans non-administrator accounts, reviews and resolves reports, and lists moderation actions. It rejects self-moderation and protects administrator accounts from the moderation interface. Successful actions record actor, target, reason, and time. Administrator grants and revocations require direct database interaction: [local SQL](LOCAL_TESTING.md#administrator-access) for development or the explicit hosted operator workflow in [deployment guidance](DEPLOYMENT.md#hosted-administrator-access).

Chat synchronization uses non-overlapping polling, pauses when the document is hidden, and backs off after failures. Notifications summarize unread conversations. Inbox and history responses are bounded; traffic and row-read usage need verification against future hosted quotas.

Synchronization has a persistent per-account request limit. Indexed inbox state supplies the latest 100 conversations plus an explicitly selected conversation; exact unread totals are read from maintained counters rather than rescanning message history. Migration `0002_chat_inbox.sql` backfills existing conversations and read positions. SQLite triggers update inbox state and account totals in the same transaction as a message insert or advancing read position. Message retries do not increment counts again, and older read positions cannot decrement them again. A read-position advance counts only the newly acknowledged range. Direct manual edits to message history or derived counters require a separate data-maintenance procedure; application workflows do not delete messages.

## API overview

All endpoints use `/api`. Shared response types live in `shared/contracts.ts`; failures have the shape `{ "error": { "code": "INVALID_INPUT" } }`. Public endpoints do not require a session. Protected endpoints require the session cookie; protected writes also require `X-CSRF-Token`.

| Area | Routes and behavior |
| --- | --- |
| Health | `GET /health` checks schema access |
| Authentication | `GET /auth/me`; `POST /auth/register`, `/auth/login`, `/auth/logout` |
| Account | `PATCH /account`; `POST /account/password` |
| Players | `GET /players/:id`; `GET /search?q=...&cursor=...` |
| Conversations | `POST /conversations`; `GET /sync`; `GET` and `POST /conversations/:id/messages`; `POST /conversations/:id/read` |
| Safety | `PUT` and `DELETE /blocks/:playerId`; `POST /reports` |
| Administration | `GET /admin/users`, `/admin/reports`, `/admin/actions`; `POST /admin/users/:id/ban`, `/admin/users/:id/unban`, `/admin/reports/:id/resolve` |

Registration accepts `username`, `email`, `password`, `passwordConfirmation`, and optional `language`, `locale`, and `timeZone`. Sign-in accepts `identifier` and `password`. Authentication results contain `account` and `csrfToken`; anonymous requests return both as `null`. Account updates accept username, bio, and formatting preferences, never email or privileges.

## Persistence and verification

D1 holds users, sessions, request counters, conversations, messages, read positions, blocks, reports, and moderation actions. SQL constraints enforce uniqueness and support application workflows. Migrations are explicit; startup does not create schemas or seed accounts.

Development persists SQLite state under ignored `.wrangler/`. Integration tests reset and migrate isolated bindings. Browser tests use synthetic accounts and separate local storage. Neither suite accesses a hosted database. See [local testing](LOCAL_TESTING.md) and [deployment status](DEPLOYMENT.md) for commands and verification limits.
