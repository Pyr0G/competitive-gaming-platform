# Competitive Gaming Platform

CGP is a CS2 tournament and recruitment platform with a Polish interface. A single Node.js service serves the frontend and `/api` from the same origin, backed by PostgreSQL. Production runs in Docker.

## Current functionality

| Area | Implemented behavior |
| --- | --- |
| Accounts | Registration with email activation, login by nickname or email, logout, activation resend, and password recovery. Passwords use bcrypt; signed JWT sessions use an httpOnly cookie, with Secure enabled in production. Resetting a password invalidates existing sessions. |
| Recruitment | Browse and filter player/team ads, publish and close your own ads. Team recruitment requires captain status. Ads expire after seven days, with at most three active ads per author. |
| Private chat | Stored one-to-one conversations, short polling, unread counts, typing indicators, blocking, and reports. |
| Tournaments | Read tournament data, registered teams, brackets, and scores from the database. |
| Ranking | Team standings calculated in the browser from completed tournament matches. This is not an Elo system. |
| Administration | User search, bans, admin permissions, manual email verification, ad moderation, report resolution, tournament cancellation/registration closure, and a site banner. |

The application is still a partial implementation of the product brief. Team creation and invitations, player profile editing, tournament creation and team registration, and actual FACEIT result import do not have backend endpoints yet. The schema includes data structures for these areas, but that does not make the workflows available.

FACEIT link submission currently simulates a result in the browser and does not save it. Map veto is also client-only. Opening `frontend/index.html` from disk runs the interface in demo mode. The frontend also falls back to demo behavior when its initial health check fails; an empty tournament response keeps the bundled sample tournaments visible. A rendered page or sample bracket alone does not verify a working backend or real tournament data.

## Stack and structure

- Node.js 22 for the production image and test baseline, Express 5, PostgreSQL 17.
- Plain HTML, CSS, and JavaScript, with no frontend build step.
- Brevo HTTP API for activation and password-reset mail. If either the API key or sender is missing, links are written to server logs instead of being delivered.

| Path | Purpose |
| --- | --- |
| `frontend/` | Site, tournament views, recruitment, ranking, accounts, map veto, chat, admin panel, and assets. |
| `backend/` | Express server, API routes, authentication, mail, database access, request limits, and automated tests. |
| `database/` | Fresh schema, local demo seed, manual upgrades, restricted application-role initialization, and [database notes](database/README.md). |
| `Dockerfile` | Production application image using Node.js 22 Alpine and the locked dependencies. |
| `docker-compose.yml` | Local PostgreSQL with demo data, published only at `127.0.0.1:5432`. |
| `docker-compose.production.yml` | Application and private PostgreSQL, without demo data, in project `cgp-production`. |
| `.env.example` / `.env.production.example` | Local and production configuration templates. |
| `DEPLOYMENT.md` | [Docker hosting, isolation, maintenance, and recovery rules](DEPLOYMENT.md). |
| `render.yaml` | Alternative Render configuration, not the current Docker deployment procedure. |

## Run locally

Install Node.js 22 and Docker with Compose. From the repository root:

```sh
cp .env.example .env
```

Set a local database password in both `POSTGRES_PASSWORD` and `DATABASE_URL`, and replace `JWT_SECRET` with a random local secret. Keep `APP_URL=http://localhost:3000`. Then run:

```sh
docker compose up -d db
cd backend
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The development command loads the root `.env` and watches the backend for changes. The local Compose file starts only the database; Node serves the application separately.

On a new local database, Compose loads `schema.sql` and `seed.sql`. With `AUTO_INIT_DATABASE=true`, the backend can also initialize an empty database outside production. Neither mechanism upgrades an existing database. For an existing local database, back it up and apply `database/upgrade.sql` as its owner before starting the updated application; see the [database upgrade notes](database/README.md#aktualizacja-istniejącej-bazy).

Seeded local accounts use `haslo123`, including `Admin` and `bartek@example.com`. These are demo credentials only; production initialization creates no users. Without Brevo configuration, local activation/reset links appear in the backend terminal.

`npm run db:reset` from `backend/` deletes the local database schema and reloads demo data. It refuses to run in production and must never be used to upgrade a deployment.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Backend PostgreSQL connection. Local development uses loopback; production Compose constructs it for the restricted `cgp_app` role. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Local database initialization. Production fixes the owner to `cgp_owner` and uses its own owner password. |
| `APP_DB_PASSWORD` | Separate production password for `cgp_app`; never use the database owner's password in the app. |
| `JWT_SECRET` | Session signing secret. Set a strong, unique value in production. |
| `APP_URL` | Public application origin used in activation/reset links and redirects. Production must use its public HTTPS address. |
| `AUTO_INIT_DATABASE` | Allows empty-database schema/demo initialization only outside production. Production Compose sets it to `false`; production rejects `true`. |
| `BREVO_API_KEY`, `MAIL_FROM` | Brevo API key and verified sender required for actual mail delivery. |
| `NODE_ENV`, `PORT` | Production Compose sets `production` and `3000`. |

Keep environment files private and out of Git. The current code does not enforce strong production secrets, HTTPS `APP_URL`, or configured mail at startup; these are operator requirements. Remote PostgreSQL connections verify TLS certificates and server names. The production `db` service uses explicitly disabled TLS only inside its private Docker network; see [deployment rules](DEPLOYMENT.md).

## Production hosting

Production uses separate application and PostgreSQL containers. The app runs as a non-root user with a read-only filesystem, dropped capabilities, and CPU, memory, process, and log limits. Production initialization loads the schema and a restricted database role without demo data or default accounts.

The application connects as `cgp_app`, which can work with data but cannot alter the schema. Running `upgrade.sql` automatically at startup would fail on owner-only operations and could prevent the app from starting. Upgrades remain a manual database-owner operation after backup and restore verification; the app does not receive the owner's credentials.

Use the [deployment guide](DEPLOYMENT.md) for container settings, production configuration, manual database upgrades, and recovery rules.

## API overview

| Prefix or endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Checks the server's database connection. |
| `GET /api/tournaments` | Tournament list, teams, brackets, and match data. |
| `GET /api/announcement` | Active site banner. |
| `/api/ads` | Read active ads; authenticated creation and closure of owned ads. |
| `/api/auth` | Register, verify, resend, login, logout, current user, forgot password, and reset password. |
| `/api/chat` | Conversations, unread counts, messages, typing, blocking, and reports; requires login. |
| `/api/admin` | Moderation, users, reports, tournament controls, statistics, and banners; requires an admin account. |

There are currently no team-management, tournament-registration, or FACEIT import endpoints. Sessions use the `cgp_session` cookie. All API requests share a limit of 300 requests per minute per client, applied before JSON parsing and session verification. IPv6 clients share an allowance within a /56 subnet. The in-memory API limiter tracks at most 10,000 active client identities and rejects new identities at capacity until entries expire. Limits reset when the application process restarts. Authentication and selected write operations retain their separate per-operation/per-client limits, with a shared limit of two concurrent password operations per application process.

## Tests and contribution rules

From the repository root, using Node.js 22 or newer:

```sh
npm ci --prefix backend
npm test --prefix backend
```

The tests use database/mail mocks and a local TLS test server. They do not require a production database or send real mail. They cover authentication and recovery, database initialization and TLS policy, request limits, chat, and frontend account/chat/admin state. Migration and backup restoration still need separate verification.

Keep code simple, without code comments. UI copy is casual Polish, without long dashes or middle dots. Use small commits with English messages prefixed by `frontend:`, `backend:`, `database:`, or `docs:`. Database changes belong in the schema, seed, and upgrade files, with their behavior described in `database/README.md`. Existing production databases are upgraded manually as the database owner, never by app startup or a reset.
