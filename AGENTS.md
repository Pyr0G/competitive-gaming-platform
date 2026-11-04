# CGP, tournament platform for CS2

Single application service: the backend serves the site and `/api` from the same origin. Production runs in Docker with a separate PostgreSQL container. Use Node.js 22 for the production image and test baseline, Express 5, PostgreSQL 17, and plain HTML, CSS and JavaScript without a frontend build step.

## Read first

- [README.md](README.md): current functionality, limitations and local setup.
- [DEPLOYMENT.md](DEPLOYMENT.md): container settings, production configuration, manual database upgrades and recovery.
- [database/README.md](database/README.md): schema, demo data and upgrade behavior.
- [CONTRIBUTING.md](CONTRIBUTING.md): contribution and validation rules.
- [SECURITY.md](SECURITY.md): private vulnerability reporting and responsible local testing.

`REQUIREMENTS.md` is an older product draft. Check the implemented routes and current documentation before treating a planned feature as available.

## Structure

| Path | What is inside |
| --- | --- |
| `frontend/` | `index.html`, `style.css`, `app.js` (tournaments, ads, ranking, account), `veto.js` (map veto), `chat.js` (direct messages), `admin.js` (admin panel), assets in `assets/` |
| `backend/` | Express server, auth, mail, tournaments, ads, chat, admin, database access, request limits and tests |
| `database/` | `schema.sql`, local `seed.sql`, manual `upgrade.sql`, `init-app-role.sh` and database notes |
| `Dockerfile` | Production application image, locked dependencies and non-root execution |
| `docker-compose.yml` | Local PostgreSQL with demo data; starts only the database |
| `docker-compose.production.yml` | Production app and database, project `cgp-production`, without demo data |
| `.env.example`, `.env.production.example` | Local and production configuration templates |
| `render.yaml` | Alternative Render configuration, not the current Docker deployment procedure |

## How it works

- At startup the backend checks for `users`. Outside production, an empty database can load `schema.sql` and `seed.sql` only when `AUTO_INIT_DATABASE=true`. Existing databases are not upgraded automatically. The presence of `users` does not prove all migrations were applied.
- Team ranking is computed in the browser from `GET /api/tournaments`.
- Map veto is client-only and is not stored.
- Chat uses short polling. Conversations are 1 to 1. Users can block and report.
- Admin accounts (`users.is_admin`) can ban people, close ads, resolve reports, cancel tournaments and set the top banner.
- Registration requires email activation. Activation and password-reset mail goes through the Brevo API. If either `BREVO_API_KEY` or `MAIL_FROM` is missing, links land in application logs instead of being delivered.
- Passwords use bcrypt. Sessions are signed JWTs in the `cgp_session` cookie with `httpOnly`, `SameSite=Lax` and `Secure` in production. Successful password recovery invalidates earlier sessions for that account.
- Authentication and selected writes use bounded per-operation/per-client limits, with two concurrent password operations shared across registration, login and reset per application process. Preserve these limits and the guards against stale account, chat and admin responses.
- Opening the site from disk or failing its initial health check enables demo behavior. An empty tournament response keeps sample tournaments visible. FACEIT result submission only simulates a result in the browser and does not save it.
- Team creation/invitations, profile editing, tournament creation/registration and real FACEIT result import have no backend endpoints yet. Tables and interface elements alone do not establish an implemented workflow.

## Production rules

- Keep documentation and shared output limited to the application and Docker containers. Do not include infrastructure topology, private addresses, identifiers or security configuration outside that boundary.
- Keep app and database responsibilities separate. The app uses restricted `cgp_app` credentials for data and sequence access. It must not receive the database owner's credentials or gain schema ownership to support migrations.
- Keep `AUTO_INIT_DATABASE=false` in production. Production rejects `true`. On a fresh empty volume, PostgreSQL loads `schema.sql` and `init-app-role.sh` to create the schema and restricted role, without `seed.sql` or default accounts. These scripts do not rerun on an existing volume.
- Database upgrades remain manual owner operations. `upgrade.sql` includes owner-only operations such as `ALTER TABLE`; running it at app startup as `cgp_app` would fail and could prevent startup. Do not add automatic startup migrations or broaden runtime privileges to make them work.
- Before upgrading, test the release and migration on a restored copy. Stop the app, take a final backup, verify restoration in a separate database, and run `upgrade.sql` as the owner with `psql -v ON_ERROR_STOP=1 --single-transaction`. Resume the app only after success. See [the upgrade procedure](DEPLOYMENT.md#upgrading-an-existing-database).
- Keep upgrades safe to repeat and preserve existing data and administrator grants. Grant the existing `cgp_app` role the required access to added tables and sequences; do not grant schema-changing privileges.
- Never use `db:reset`, reload schema/seed files or remove a volume to upgrade production. Preserve persistent data. Before rolling back an image, check schema compatibility; verify backup restoration separately from application tests.
- Preserve non-root app execution, the read-only filesystem, dropped capabilities, `no-new-privileges`, bounded temporary storage and CPU/memory/process/log limits. Changes must work within those container constraints. Install production dependencies from the lockfile with install scripts disabled.
- Keep secrets out of Git, images, shared logs and reports. Use separate strong owner/app passwords and a unique session secret. Check HTTPS `APP_URL` and Brevo sender/key before release; startup does not enforce those requirements. Preserve certificate and hostname verification for remote database connections.
- Provision production administrators by verified account identity and explicit `users.id`, after email confirmation. Never grant privileges based on the nickname `Admin`. Demo credentials are local-only.

## API

| Method and path | What it does |
| --- | --- |
| `GET /api/health` | server and database check |
| `GET /api/announcement` | active site banner |
| `GET /api/tournaments` | tournaments, brackets and registered teams |
| `GET /api/ads` | active ads, `mine` marks your own |
| `POST /api/ads` | new ad (logged in, LFM only for captains, max 3) |
| `DELETE /api/ads/:id` | close your own ad |
| `POST /api/auth/register` | register and send an activation link |
| `GET /api/auth/verify?token=` | activate the account from mail |
| `POST /api/auth/login` | login with nick or email |
| `POST /api/auth/logout` | logout |
| `GET /api/auth/me` | current user, `admin` and `team` |
| `POST /api/auth/resend` | resend the activation link |
| `POST /api/auth/forgot` | password reset link |
| `POST /api/auth/reset` | set a new password |
| `GET /api/chat` | conversation list |
| `GET /api/chat/unread` | unread count |
| `POST /api/chat/open` | start or open a chat with `userId` |
| `GET /api/chat/:id` | messages, `?after=` for new ones |
| `POST /api/chat/:id` | send a message |
| `POST /api/chat/:id/typing` | typing ping |
| `POST /api/chat/:id/block` | block the other user |
| `DELETE /api/chat/:id/block` | unblock |
| `POST /api/chat/:id/report` | report the other user |
| `GET /api/admin/stats` | admin overview |
| `GET /api/admin/users` | user list, `?q=` search |
| `POST /api/admin/users/:id/ban` | ban |
| `POST /api/admin/users/:id/unban` | unban |
| `POST /api/admin/users/:id/admin` | grant or drop admin (`on`) |
| `POST /api/admin/users/:id/verify` | mark email as verified |
| `GET /api/admin/ads` | all ads |
| `DELETE /api/admin/ads/:id` | close any ad |
| `GET /api/admin/reports` | reports plus last messages |
| `POST /api/admin/reports/:id/resolve` | close a report |
| `GET /api/admin/tournaments` | tournament list |
| `POST /api/admin/tournaments/:id/cancel` | cancel a tournament |
| `POST /api/admin/tournaments/:id/close-reg` | close registration |
| `GET /api/admin/announcement` | current banner |
| `POST /api/admin/announcement` | set the banner |
| `DELETE /api/admin/announcement` | hide the banner |

## Run locally

1. Install Node.js 22 and Docker with Compose. Copy `.env.example` to `.env`.
2. Match `POSTGRES_PASSWORD` and the password in `DATABASE_URL`, replace `JWT_SECRET`, and keep `APP_URL=http://localhost:3000`.
3. From the repository root, run `docker compose up -d db` and `npm ci --prefix backend`.
4. Run `cd backend`, then `npm run dev`, which loads the root `.env` and watches backend changes.
5. Open `http://localhost:3000`.

Local Compose loads schema and seed only on a new database volume. Back up and manually upgrade an existing local database as its owner. Do not combine the local and production Compose files.

`npm run db:reset` from `backend/` deletes the schema and reloads demo data. Use it only with a disposable local database; it refuses to run in production.

## Validation

- For application changes, run `npm test --prefix backend` from the repository root on Node.js 22 or newer. Add or update tests when needed for changed behavior or a regression.
- Tests use database/mail mocks and a local TLS server. They do not need production access or send real mail, and they do not verify migrations or backup restoration.
- Verify database changes through fresh initialization and an existing-database upgrade in a separate local environment.
- For frontend changes, check affected flows in a browser and relevant signed-out, signed-in, captain and admin states. Check desktop and mobile layouts for visual changes.
- Verify backend-dependent behavior with the local backend and database running, `GET /api/health`, and the affected API requests. Demo output or a rendered page alone does not prove data is saved.
- For documentation-only changes, check formatting, links and instructions. State what was checked and any unverified behavior. Keep repository checks and live deployment verification distinct.

## Code rules

- No comments in code. Keep it simple and readable.
- UI copy in Polish, casual, no long dashes and no middle dots. Repository guidance and contribution documents are in English.
- Commit messages in English only, prefix with the area: `frontend:`, `backend:`, `database:`, `docs:`.
- Database changes go into `schema.sql`, `seed.sql` and `upgrade.sql`. Describe them in `database/README.md`.
- Seeded local test accounts use password `haslo123` and mails like `bartek@example.com`. Local demo admin login: `Admin` / `haslo123`. Production initialization creates no users.
- Small commits, one topic each.
