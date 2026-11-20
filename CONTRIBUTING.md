# Contributing to CGP

CGP uses React, TypeScript, and SQLite through local Cloudflare Workers and D1 tooling. Development stays local; hosted configuration and deployment require a separate release decision.

Read the [README](README.md), [architecture](docs/ARCHITECTURE.md), [working rules](AGENTS.md), and [security policy](SECURITY.md) first.

## Discuss a change

Describe the player or moderator problem and observable acceptance criteria. Identify the affected component and version. Keep future functionality distinct from working behavior.

Use issue and pull request templates for ordinary changes. Report vulnerabilities privately using [SECURITY.md](SECURITY.md).

## Implementation rules

- Keep code simple and readable, without code comments. Use TypeScript, focused components, and explicit interfaces.
- Centralize reusable styles, design tokens, typography, and shared controls.
- Keep application copy and accessible labels in shared English and Polish catalogs, with English fallback. Keep language, regional formatting, and time zones separate.
- Enforce validation, authentication, authorization, request limits, and private-data boundaries on the server. Client route protection does not grant access.
- Use prepared SQL and versioned migrations. Do not mutate schemas or seed users on startup.
- Keep administrator grants and revocations outside public APIs and the interface; document direct local SQL where needed.
- Keep maintained documentation in English. Use small commits with English messages prefixed by `frontend:`, `backend:`, `database:`, or `docs:`.

## Validate changes

Use Node.js 24 or newer and pnpm 11.25.0. Follow [local testing](docs/LOCAL_TESTING.md) for setup, isolation, and browser checks.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:e2e
```

Install Playwright Chromium before the first browser run. Include checks, results, and unverified behavior in the pull request. Inspect desktop and mobile layouts, keyboard navigation, relevant account states, and both languages for interface changes. Verify fresh storage and applicable migrations using disposable data for schema changes.

Run Codex Security after implementation changes, fix validated vulnerabilities, and review the resulting security fixes. Include the reviewed scope and results without publishing exploit details or private evidence. Tests and scans do not prove that every vulnerability is absent.

For documentation, check formatting, links, anchors, and commands against the repository. Do not invent release or hosted setup commands.

Local checks do not validate hosting or production restoration.

## Public content

Use generic domains, immutable-ID placeholders, and synthetic accounts. Review code, documentation, templates, screenshots, logs, commit messages, and proposed history for credentials, tokens, personal data, private addresses, infrastructure topology, machine or account identifiers, and deployment-specific paths.

Keep operator records outside the public repository. Do not include real session cookies, messages, passwords, or private reports in issues or test evidence.
