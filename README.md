# CGP

CGP is a Counter-Strike 2 community application built with React, TypeScript, and SQLite. This initial version runs locally using Cloudflare's Workers runtime, local D1 storage, and a private password-hashing Durable Object. No hosted release is configured or verified.

## Available features

- A responsive shell with shared styling, a sidebar, player search, message notifications, chat, language controls, and account access. The home content area is intentionally empty.
- Registration, username-or-email sign-in, sign-out, public profiles, profile editing, password changes, and language, region, and time-zone preferences.
- Private one-to-one text conversations, unread counts, message history, blocking, and message reporting.
- An administrator panel for user search, bans and unbans, report review, report resolution, and moderation history. Administrator access is assigned only through direct database changes.
- Shared English and Polish copy, English fallback, and locale-aware dates and numbers.
- A public Guide at `/guide`, below Rankings in the sidebar, with six numbered sections: How it works, Tournaments, Recruitment, Tournament bracket and results, Rankings, and Map veto, followed by a recruitment call to action. It includes a four-step animated tutorial, tournament status filters and sample countdowns, recruitment filters and form previews, registered-team rosters, match details, simulated result checks that update the sample bracket and eight-team standings, and BO1/BO3 veto with auto-complete and reset. Examples stay in page memory and reset on leaving or reloading the Guide. They do not create records, import real results, or contact external services. Tutorial playback pauses on hover, focus, hidden tabs, or leaving the viewport, and respects reduced-motion preferences.

Tournament, team, recruitment, and ranking navigation represents future functionality. The CGP logo returns to home; the shared footer provides Guide, search, and language controls. Search returns real players; team and tournament categories are explicitly unavailable. Notifications currently concern chat only. Email delivery, verification, password recovery, attachments, and external integrations are not included.

## Run locally

Install Node.js 24 or newer, including npm, and pnpm 11.25.0 in your normal terminal. Tools bundled with an editor do not necessarily exist in a separate PowerShell window. See [install development tools](docs/LOCAL_TESTING.md#install-development-tools) for first-time setup and missing-command errors.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The server binds to the loopback interface. These commands do not require a Cloudflare account, login, remote database, or deployment. Use the same hostname throughout a browser session.

SQLite data persists under ignored `.wrangler/` state. Migrations are explicit; starting the server does not initialize, reset, or populate the database. Do not commit database files, credentials, or session data.

Register your own local accounts. Accounts become active immediately. Email addresses stay private and are read-only in the account page; they are not verified and cannot currently be used for password recovery.

Usernames accept 3-24 Unicode code points, starting with a letter or number and followed by letters, combining marks, numbers, underscores, dots, or hyphens. Usernames are normalized for uniqueness. Passwords accept 8-128 Unicode code points, including spaces, without composition requirements or silent trimming. Escape dismisses the sign-in or registration page and returns to home; an open dialog closes first.

See [local testing](docs/LOCAL_TESTING.md) for a two-browser walkthrough and administrator setup.

## Development commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the local interface and API at port 5173 |
| `pnpm db:migrate` | Apply local D1 migrations |
| `pnpm db:sql --command "SELECT id, username FROM users;"` | Query the local database |
| `pnpm typecheck` | Check TypeScript |
| `pnpm lint` | Check application, API, shared types, and tests |
| `pnpm test` | Run isolated Worker and SQLite integration tests |
| `pnpm test:e2e` | Run isolated browser tests |
| `pnpm build` | Type-check and build the application |
| `pnpm preview` | Preview the built application locally at port 4173 |
| `pnpm check` | Run type checking, lint, integration tests, and the build |

Run `pnpm exec playwright install chromium` before the first browser test. Browser installation downloads a test browser; it does not configure hosting. Build before running preview. See [local testing](docs/LOCAL_TESTING.md) for test isolation and verification limits.

## Repository layout

```text
src/main.tsx         React entry point
src/app/             Application state, providers, and shell
src/features/        Accounts, administration, chat, Guide, players, and search
src/components/      Shared interface controls
src/lib/             Shared API client
src/i18n/            English/Polish catalogs and locale formatting
src/styles/          Centralized CSS, design tokens, and fonts
public/              Brand and Guide images, fonts, flags, and redistribution notices
worker/              API, authentication, moderation, chat, and password hashing
shared/              Public TypeScript contracts
migrations/          Versioned application SQL migrations
tests/               Local API and browser checks
docs/                Architecture, local testing, and deployment guidance
wrangler.local.jsonc Local runtime and storage bindings
```

## Project guidance

- [Architecture and data boundaries](docs/ARCHITECTURE.md)
- [Local testing and administrator setup](docs/LOCAL_TESTING.md)
- [Feature roadmap and task dependencies](docs/TODO.md)
- [Contribution rules](CONTRIBUTING.md)
- [Deployment status](docs/DEPLOYMENT.md)
- [Security policy](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

Use portable setup instructions and synthetic examples in public content. Keep private infrastructure, account identifiers, credentials, and personal data outside the repository and shared evidence.
