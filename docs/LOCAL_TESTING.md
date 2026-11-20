# Local testing

## Install development tools

Install [Node.js 24 or newer](https://nodejs.org/en/download/), including npm. On Windows, use the installer option that adds Node.js to PATH. Close and reopen your terminal after installation.

In Windows PowerShell, verify Node.js and install the project's pinned pnpm version:

```powershell
node --version
npm.cmd install --global pnpm@11.25.0
pnpm.cmd --version
```

The Node.js version must be at least 24 and pnpm must report `11.25.0`. On other platforms, use `npm` and `pnpm` instead of their `.cmd` forms.

If PowerShell says `pnpm` is not recognized, install it as above and reopen the terminal. If the command is still missing, run `npm.cmd prefix --global` and check that the returned directory is included in your Windows user PATH. A package manager available inside an editor is not necessarily installed for your regular terminal.

If PowerShell blocks a `pnpm.ps1` script, use `pnpm.cmd` for the commands below; no execution-policy change is needed. Do not append a backslash to a command: it is not a PowerShell line-continuation character.

## Start CGP

Use Node.js 24 or newer and pnpm 11.25.0. Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). No Cloudflare login, remote database, or deployment is needed. Use the same hostname for every request in a session. SQLite data persists under ignored `.wrangler/` state.

Migrations do not run automatically. Run `pnpm db:migrate` after adding a migration. Preserve local data you need before changing or removing development storage. There is no automatic reset or application-user seed.

For a built local preview:

```sh
pnpm build
pnpm preview
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Preview does not publish the application.

## Automated checks

```sh
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm check` runs TypeScript, lint, Worker integration tests, and the build. Individual commands are in the [README](../README.md#development-commands).

Tool configuration stays in the repository root. TypeScript writes its generated build cache to `node_modules/.cache/typescript/cgp.tsbuildinfo`, which is ignored with the dependencies and recreated by the checks when needed.

Integration tests run the real local Worker and password-hashing object with isolated D1 bindings. Setup resets and reapplies migrations before each test. Tests use synthetic data and do not access external services.

Chat checks cover migration from existing message history, exact unread counts during retries and concurrent reads, account-level synchronization limits across sessions, and database read work as unread history grows. Search checks include long Unicode terms, literal pattern characters, and pagination. Apply all local migrations before using an existing development database; `0002_chat_inbox.sql` preserves messages and read positions while initializing inbox counters.

Check both runtime and development dependency advisories with `pnpm audit`. An advisory-free result describes the registry data available at that time; it is not a complete security assessment.

Browser tests start their own local application at `http://127.0.0.1:5174` and populate disposable synthetic accounts in `.wrangler/e2e/`. Setup clears only that test database. They do not use or reset the normal development database. Browser installation is needed before the first run or after a Playwright version change. Keep port 5174 available; the [browser configuration](../playwright.config.ts) deliberately refuses to reuse an unrelated server.

Results apply to the tested revision and local configuration. Local tooling does not enforce hosted CPU limits or establish production quota capacity, mail delivery, restoration, or deployment correctness.

## Two-browser walkthrough

Use two browser profiles or a regular window and a private window so cookies stay separate. Use synthetic usernames and email addresses such as `player-one@example.com`; do not share real credentials or messages in evidence.

1. Create a different account in each window. Confirm both are active immediately and can sign out and sign back in using username or email.
2. Check that home content is empty, the shared shell stays visible, and future navigation does not pretend to implement its features.
3. Change English/Polish language, region, and time zone. Check labels and dates. Update username and bio, reload, and confirm persistence. Email stays private and read-only.
4. Search for the other username, open its profile, and start a conversation. Send messages both ways, reload, and confirm history. Check top-bar unread counts and chat notifications in the receiving window.
5. Open the receiving conversation and confirm its unread count clears. Check earlier history when enough messages exist. A failed send should retain the draft and permit retry.
6. Block the other player. Confirm sending stops in both directions, then unblock and retry. Report a received message with a synthetic reason.
7. Give a separate test account administrator access below. Review bounded report evidence, resolve the report, and confirm moderation history.
8. Ban a non-administrator account and confirm its session stops working and sign-in is denied. Unban it and sign in again. The panel must not offer administrator grants or administrator-account moderation.
9. Sign in to one account in both windows. Change its password with the current password and confirm both old sessions end. Sign in with the new password and verify sign-out.
10. Repeat key flows at mobile width, with keyboard navigation, and in both languages. Check dialog focus, readable errors, long Unicode names, and messages.
11. Open Guide below Rankings in the sidebar or mobile navigation. Check the six numbered sections and final recruitment call to action. Watch and manually select the four How it works steps; check pause, hover/focus suspension, viewport suspension, and reduced motion. Filter tournament cards by status, open registered teams and roster dialogs, and select bracket matches. Test recruitment role, level, and availability filters, the empty state, conversation preview, and listing form preview. In the result form, try an invalid link, use the example link, and simulate a result: confirm the winner advances and standings update only on this page. Reusing a reference must be rejected. Reset tournament examples and confirm the original bracket and statistics return. Complete a BO3 veto, switch to BO1, try auto-complete, and reset during selection; check distinct teams, history, and map order. Repeat at narrow mobile widths, with keyboard navigation and in Polish. Only the bracket and standings may scroll horizontally at narrow widths. Reload or leave the Guide to clear examples. No preview action should create records or fetch a real match. The home content area must remain empty.

Email verification, recovery, attachments, team management, tournaments, recruitment, rankings, and map veto have no live workflow in this version. The Guide presents illustrative previews of future features.

## Administrator access

Create a normal account first. In a terminal at the repository root, find its immutable ID:

```sh
pnpm db:sql --command "SELECT id, username, is_admin FROM users ORDER BY created_at;"
```

Replace `<USER_ID>` with the selected account's ID. Grant access:

```sh
pnpm db:sql --command "UPDATE users SET is_admin = 1 WHERE id = '<USER_ID>';"
```

Refresh the browser to show the administrator panel. Every request checks the current database flag. Revoke access with:

```sh
pnpm db:sql --command "UPDATE users SET is_admin = 0 WHERE id = '<USER_ID>';"
```

Confirm the next administrator request is denied, then refresh the interface. Scripts force local execution. There is no seeded administrator, default administrator password, public role-editing endpoint, or role-editing control.

## Troubleshooting

- A missing `node`, `npm`, or `pnpm` command is a tool installation or PATH issue. Follow [install development tools](#install-development-tools) before running application commands.
- A missing-table error usually means migrations were not applied to current storage. Run `pnpm db:migrate`; do not reset data first.
- Use `127.0.0.1` consistently. Another hostname changes the origin and cookies.
- Old sessions should fail after password changes or bans. Sign in again only when the account is eligible.
- A request-limit response requires waiting for its retry interval. Restarting the server does not clear persisted limits.
- Inspect errors using synthetic data. Never publish cookies, CSRF tokens, passwords, emails, private report evidence, or local operator details.
