# CGP, tournament platform for CS2

Single service: the backend serves the site and the API from the same origin.

## Structure

| Folder | What is inside |
| --- | --- |
| `frontend/` | `index.html`, `style.css`, `app.js` (tournaments, ads, ranking, account), `veto.js` (map veto), `chat.js` (direct messages), `admin.js` (admin panel), assets in `assets/` |
| `backend/` | Node.js + Express: auth, mail, tournaments, ads, chat, admin |
| `database/` | `schema.sql`, `seed.sql`, `upgrade.sql` (safe adds on existing databases), notes in `README.md` |
| `render.yaml` | Render hosting config |

## How it works

- On start the backend checks the database. An empty database gets `schema.sql` and `seed.sql`. Existing databases get `upgrade.sql`.
- Team ranking is computed in the browser from `GET /api/tournaments`.
- Map veto is client-only and is not stored.
- Chat uses short polling. Conversations are 1 to 1. Users can block and report.
- Admin accounts (`users.is_admin`) can ban people, close ads, resolve reports, cancel tournaments and set the top banner.
- Mail (activation, password reset) goes through the Brevo API. Without a key, links land in the server log.
- Session is a signed `cgp_session` cookie (httpOnly).
- The site also works without a backend (opened from disk). Forms then run in demo mode.

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

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. `cd backend`, then `npm install` and `npm run dev`.
3. Open `http://localhost:3000`.

`npm run db:reset` wipes the database and loads it again.

## Code rules

- No comments in code. Keep it simple and readable.
- UI copy in Polish, casual, no long dashes and no middle dots.
- Commit messages in English only, prefix with the area: `frontend:`, `backend:`, `database:`, `docs:`.
- Database changes go into `schema.sql`, `seed.sql` and `upgrade.sql`. Describe them in `database/README.md`.
- Test accounts use password `haslo123` and mails like `bartek@example.com`. Admin login: `Admin` / `haslo123`.
- Small commits, one topic each.
