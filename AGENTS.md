# Working on CGP

## Project state

CGP is a React and TypeScript application with a Worker API and SQLite storage through D1. The initial version supports accounts, public profiles, player search, private text chat, blocking, message reports, and basic moderation. The home content area is empty; future sidebar entries do not implement their features.

Version 0.1.0 has an initial Cloudflare deployment. Default to local development; hosted changes require explicit authorization. `wrangler.local.jsonc` exists for offline runtime and storage simulation. Do not log in to Cloudflare, create remote resources, configure domains, or deploy as part of ordinary local development. Keep production identifiers and credentials outside version control.

## Read first

- [README.md](README.md): available behavior, layout, and commands.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): runtime, storage, API, and security boundaries.
- [docs/LOCAL_TESTING.md](docs/LOCAL_TESTING.md): checks and administrator access.
- [CONTRIBUTING.md](CONTRIBUTING.md): implementation and validation.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): hosted-release status.
- [SECURITY.md](SECURITY.md): private reporting and responsible testing.

## Implementation and public repository rules

- Keep code simple and readable, without code comments. Avoid unnecessary dependencies and client-side logic.
- Group frontend features under `src/features/`. Keep the application shell and providers in `src/app/`, shared controls in `src/components/`, the API client in `src/lib/`, translations in `src/i18n/`, and centralized CSS in `src/styles/`.
- Centralize design tokens, reusable styles, fonts, and shared controls.
- Keep application copy and accessible labels in shared English and Polish catalogs. English is the fallback. Use locale-aware formatting and explicit time zones.
- Use prepared SQL and explicit migrations; do not initialize schemas or seed accounts on startup.
- Preserve server-side authorization, participant-only chat, CSRF and origin checks, request limits, private password hashing, and immediate session revocation.
- Grant or revoke administrators only through direct database interaction. Never add a public role-editing route or seeded administrator.
- Limit public content to portable setup and application behavior. Use synthetic data, generic domains, and placeholders; exclude private infrastructure, addresses, machine or account identifiers, deployment paths, credentials, and unrelated security configuration.
- Check documentation, templates, screenshots, commit messages, and proposed history for private information as well as code.
- Call the application CGP in maintained guidance. Distinguish working behavior, future features, local checks, and hosted verification.
- Keep maintained guidance in English. Use small commits with English messages prefixed by `frontend:`, `backend:`, `database:`, or `docs:`.

## Validation

Use Node.js 24 or newer and pnpm 11.25.0. Run `pnpm check` for application changes and relevant `pnpm test:e2e` scenarios. Use the real local Worker runtime and isolated SQLite storage for integration tests. Local CPU behavior does not prove hosted Free-plan limits.

For documentation, verify formatting, links, anchors, and commands.

Run Codex Security after implementation changes and address validated vulnerabilities before hosted-release review. Do not claim tests or scans prove the absence of every vulnerability.
