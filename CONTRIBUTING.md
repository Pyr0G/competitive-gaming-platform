# Contributing to CGP

CGP helps amateur CS2 players find teammates, communicate, and take part in tournaments. Contributions should support that player journey and keep the platform simple to use.

## Read first

- [README.md](README.md) describes the current implementation, local setup, and known limitations.
- [AGENTS.md](AGENTS.md) contains the repository's coding and commit rules.
- [DEPLOYMENT.md](DEPLOYMENT.md) covers production configuration, manual database upgrades, and recovery.
- [Database notes](database/README.md) explain the schema, demo data, and upgrade behavior.
- [REQUIREMENTS.md](REQUIREMENTS.md) explains the original product idea. It is an older draft and does not describe all current behavior. Use the README and deployment guide for the current state, and discuss changes to the intended product in an issue.

Team management, invitations, tournament registration, and FACEIT result import are still incomplete. The current email activation flow and polling chat also differ from the original requirements. A requirement or database table alone does not mean a feature is implemented.

## Report a bug or suggest a feature

Check existing issues and pull requests before opening a new issue. Use the [bug report](.github/ISSUE_TEMPLATE/bug_report.md) or [feature request](.github/ISSUE_TEMPLATE/feature_request.md) template.

For bugs, include steps to reproduce, expected and actual behavior, your environment, and relevant screenshots or error messages. Say whether you used the running backend or demo mode.

For features, explain the player or organizer's problem, the proposed behavior, and observable acceptance criteria. Discuss substantial workflow changes, new dependencies, and external integrations in an issue before implementing them. Keep planned features distinct from behavior already available in the application.

Remove passwords, API keys, session cookies, activation/reset links, and personal data from anything you share.

## Set up locally

Install Node.js 22 and Docker with Compose. From the repository root:

```sh
cp .env.example .env
```

In PowerShell, use `Copy-Item .env.example .env`. Set a local database password in both `POSTGRES_PASSWORD` and `DATABASE_URL`, replace `JWT_SECRET` with a random local secret, and keep `APP_URL=http://localhost:3000`.

```sh
docker compose up -d db
npm ci --prefix backend
cd backend
npm run dev
```

Open [localhost:3000](http://localhost:3000). The local Compose file starts PostgreSQL; Node serves both the frontend and API. There is no frontend build step. See the [README](README.md#run-locally) for initialization details and existing local databases.

Seeded local accounts use `haslo123`, including `Admin` and `bartek@example.com`. Use these only with local demo data. Without Brevo configuration, activation and password-reset links appear in the backend terminal.

Keep `.env` and `.env.production` private and out of Git. Use local test data for development.

## Make focused changes

- Keep code simple and readable, without code comments.
- Write UI copy in casual Polish, without long dashes or middle dots. Keep contribution documents and templates in English.
- Follow the existing plain HTML, CSS, JavaScript, and Express structure. The backend serves the site and API from the same origin.
- Keep each pull request focused on one topic. Separate unrelated fixes and formatting changes.
- Update documentation when behavior, configuration, or setup changes.
- Use small commits with English messages prefixed by `frontend:`, `backend:`, `database:`, or `docs:`. For example: `backend: fix unread message count`.

## Validate your changes

From the repository root, using Node.js 22 or newer:

```sh
npm ci --prefix backend
npm test --prefix backend
```

Run the suite for application changes and add or update tests when needed to cover changed behavior or a regression. Existing tests use database/mail mocks and a local TLS server. They do not require production access or send real emails. They do not verify database migrations or backup restoration.

For frontend changes, also check the affected pages and user flows in a browser. Include signed-in, signed-out, captain, or admin states where relevant, and check the layout at desktop and mobile widths for visual changes.

Verify backend-dependent behavior with the local server and database running. Check `GET /api/health` and the affected API calls. The frontend can fall back to demo mode or show sample tournaments, so a rendered page alone is not evidence that data is being saved. Map veto and simulated FACEIT results currently stay in the browser.

For documentation-only changes, check formatting, links, and instructions. Record what you checked and explain any validation you could not complete.

## Change the database safely

Keep `database/schema.sql`, `database/seed.sql`, and `database/upgrade.sql` consistent with database changes, and describe them in [database/README.md](database/README.md).

- `schema.sql` defines a fresh database.
- `seed.sql` contains local demo data. Keep test emails in the form `bartek@example.com` and demo passwords as `haslo123`.
- `upgrade.sql` updates an existing database while preserving data. Keep it safe to repeat and grant the existing `cgp_app` role access to added tables and sequences where needed.

Verify both fresh initialization and upgrades of an existing database in a separate local environment. Application tests alone do not cover these paths.

Production upgrades are manual database-owner operations after a backup and verified restoration, following [DEPLOYMENT.md](DEPLOYMENT.md#upgrading-an-existing-database). Keep `AUTO_INIT_DATABASE=false` in production. The app uses restricted `cgp_app` credentials and must not run migrations at startup or receive the owner's credentials.

Never use `db:reset`, remove a database volume, or reload schema/seed files to upgrade an existing deployment. `db:reset` deletes the schema and reloads demo data; it is only for a disposable local database.

## Submit a pull request

1. Create a descriptive branch for your change.
2. Make focused commits and complete the relevant checks above.
3. Open a pull request using the [PR template](.github/pull_request_template.md).
4. Explain the problem, the resulting behavior, and any limitations. Link related issues; use `Closes #123` only when the change fully resolves that issue.
5. Include validation commands or manual steps and their results, plus screenshots for visual changes.
6. Describe database upgrades, configuration changes, and manual deployment steps when applicable.

Keep deployment actions separate from the code review. A passing test suite does not verify a live deployment, email delivery, or database restoration.
