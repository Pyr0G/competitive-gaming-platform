# Docker hosting

CGP runs in Docker as a Node.js application and a separate PostgreSQL container. The backend serves the frontend and API from the same origin. This document covers container configuration and application maintenance.

## Files

| File | Purpose |
| --- | --- |
| `Dockerfile` | Application image based on Node.js 22 Alpine. |
| `docker-compose.yml` | Local PostgreSQL 17 database with sample data. |
| `docker-compose.production.yml` | Base production container configuration, using the `cgp-production` project. |
| `.env.production.example` | Production environment variable template. |
| `database/schema.sql` | Schema for a new, empty database. |
| `database/init-app-role.sh` | Creates the restricted application role during initial database setup. |
| `database/upgrade.sql` | Manual upgrade of an existing database. |
| `database/seed.sql` | Demo data for local development only. |

Do not combine the local and production Compose files. The local configuration loads sample accounts and tournaments; production initializes only the schema and application role.

## Container settings

The application image installs dependencies from `package-lock.json` using `npm ci --omit=dev --ignore-scripts`. There is no separate frontend build step. The app runs as the `node` user, with a read-only filesystem, all capabilities dropped, and `no-new-privileges`.

| Limit | Application | PostgreSQL |
| --- | --- | --- |
| CPU | 1 CPU | 1 CPU |
| Memory / combined memory and swap | 512 MiB / 512 MiB | 512 MiB / 512 MiB |
| Processes | 64 | 128 |
| Logs | 3 files of 10 MB each | 3 files of 10 MB each |

The app has a 16 MiB temporary `/tmp` directory with `noexec,nosuid` and a 256 MiB Node heap limit. PostgreSQL stores its data in a persistent volume. Memory and log limits do not limit the size of PostgreSQL data.

## Application configuration

Use `.env.production.example` as the template for private configuration. Keep secrets out of Git and the application image.

| Variable | Requirement |
| --- | --- |
| `POSTGRES_DB` | Database name. |
| `POSTGRES_PASSWORD` | Separate password for the database owner, `cgp_owner`. |
| `APP_DB_PASSWORD` | Different password for the restricted `cgp_app` role. Use a URL-safe value, such as a random hexadecimal string. |
| `JWT_SECRET` | Strong, unique session signing secret. |
| `APP_URL` | Public HTTPS application URL, used in activation and password-reset links. |
| `BREVO_API_KEY`, `MAIL_FROM` | Brevo API key and verified sender for email delivery. |

Generate independent random passwords and a session secret, each at least 32 characters long. Production Compose sets `NODE_ENV=production` and `AUTO_INIT_DATABASE=false`, and constructs `DATABASE_URL` for `cgp_app`.

The code rejects `AUTO_INIT_DATABASE=true` in production, but does not enforce a strong secret, an HTTPS URL, or configured email at startup. Check these values before release. Without the Brevo key or sender, activation and password-reset links are written to application logs instead of being delivered.

## Why database upgrades are manual

The application connects to the database as `cgp_app`. This role can read, insert, update, and delete data, and use sequences. It does not own the tables or have permission to change the database structure.

`database/upgrade.sql` performs operations such as `ALTER TABLE` and table creation. Running it automatically at application startup with the restricted role would fail with a permission error and could prevent the service from starting. Giving the application the database owner's credentials would increase its privileges just to run migrations.

Migrations therefore remain a separate, manual operation performed as the database owner, after taking a backup and verifying restoration. Restarting the app does not change the schema. The database owner's password is not passed to the application container.

## New database versus existing volume

On a new, empty volume, the PostgreSQL container runs `schema.sql`, followed by `init-app-role.sh`. This creates the schema and `cgp_app` role, without demo data or user accounts.

Initialization scripts do not run again on an existing volume. Changing an SQL file or recreating the container does not upgrade that database.

At startup, the backend checks whether the `users` table exists. If it is missing and initialization is disabled, startup fails. The presence of this table does not confirm that all migrations have been applied.

`AUTO_INIT_DATABASE=true` allows schema and demo initialization only outside production. It is not a migration mechanism. `npm run db:reset` deletes the schema and reloads demo data; it refuses to run in production and is not an upgrade procedure.

<a id="aktualizacja-istniejącej-bazy"></a>

## Upgrading an existing database

1. Prepare the new release and test it together with the migration against a restored database backup.
2. Stop the application for the upgrade. The database must remain accessible to the administrator.
3. Take a final backup and verify restoration into a separate database. Keep the backup independently of the production volume.
4. Run `database/upgrade.sql` as the database owner, stopping on errors and using a single transaction.
5. Only after a successful migration, start the prepared application release and verify its behavior.

For a `psql` client already configured to connect to the correct database as its owner, run this from the release root:

```sh
psql -v ON_ERROR_STOP=1 --single-transaction --file=database/upgrade.sql
```

Check the target database and connection role before running the command. Administrator connection credentials remain outside the application configuration.

On error, the transaction is rolled back. Leave the app stopped and fix the cause before retrying. The upgrade can be repeated; it preserves data and existing administrator permissions.

The script grants an existing `cgp_app` role access to the added chat, block, report, and announcement tables and their sequences. It does not create that role or grant permission to change the database structure.

Do not run `schema.sql`, `seed.sql`, or `db:reset` against an existing production database. Do not remove the volume to force initialization.

## Accounts and sessions

Production has no default administrator or seeded accounts using `haslo123`. The database owner grants `users.is_admin` to a specific `users.id` after checking the account owner's identity and confirming their email. The nickname `Admin` does not grant privileges.

A session is a signed JWT in the `cgp_session` cookie, with `httpOnly`, `SameSite=Lax`, and `Secure` in production. Sessions are tied to the current password hash; a successful password reset invalidates the account's earlier sessions. A release that changes the session format requires users to sign in again.

See the [database notes](database/README.md#aktualizacja-istniejącej-bazy) for more information about migrations and previous administrator grants.

## Release checks and rollback

Check `GET /api/health`, tournament and ad reads, login, chat, the admin panel, and delivery of activation and password-reset emails. The appearance of the page alone does not confirm a working database: the frontend can display sample tournaments or run forms in demo mode.

Keep the previous application image and a verified database backup. Before restoring an older image, confirm that it supports the current schema. Rehearse database restoration in a separate environment and account for the loss of changes made since the backup. Do not use `down -v` or volume pruning to roll back a release.

## Code tests

From the repository root, using Node.js 22 or newer:

```sh
npm ci --prefix backend
npm test --prefix backend
```

The tests use database and mail mocks, plus a local TLS server. They cover authentication and account recovery, database initialization, PostgreSQL TLS verification, request and password-work limits, chat, and browser account, chat, and admin state. They do not send real emails or connect to the production database. They do not replace migration and restore testing.
