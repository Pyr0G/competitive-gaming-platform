# Competitive Gaming Platform

CGP is a platform for Counter-Strike 2 tournaments, team recruitment, and player communication.

> **Project status: complete rebuild.** CGP is being created as a new React application with SQLite storage, hosted entirely on Cloudflare. Development stays in this repository. The previous application is preserved in [`prototype/`](prototype/) as reference material, with only selected parts expected to be reused.

The new application has not been implemented in this revision. The prototype's features, API, database, and deployment files describe the previous implementation and do not establish functionality in the new program. The previous hosted deployment has been retired.

## Project direction

| Area | New CGP | Preserved prototype |
| --- | --- | --- |
| Interface | React | Plain HTML, CSS, and JavaScript |
| Storage | SQLite on Cloudflare | PostgreSQL 17 |
| Hosting | Entirely on Cloudflare | Optional Docker reproduction |
| Purpose | New application developed in this repository | Reference for behavior, design, and selected reusable work |

See the [rebuild notes](docs/REBUILD.md) for the scope and the distinction between planned and implemented behavior. Cloudflare service configuration, the new schema, and development and deployment commands will be documented with the implementation.

## Repository layout

```text
prototype/          Previous application, assets, tests, and setup guides
docs/REBUILD.md      Direction and scope of the new application
.github/            Issue and pull request templates
AGENTS.md           Repository working rules
CONTRIBUTING.md     Contribution and validation guidance
DEPLOYMENT.md       Deployment status and documentation entry point
SECURITY.md         Private vulnerability reporting
```

New CGP source will be added alongside `prototype/` in this repository. The prototype is retained for reference rather than used as the starting application structure.

## Explore the prototype

The prototype includes email-activated accounts, recruitment ads, one-to-one chat, tournament reads, browser-calculated rankings, moderation, and English and Polish interfaces. Several product flows remain incomplete, including team management, tournament registration, and real FACEIT result import. Some interface behavior is demonstration-only.

To run the reference application, install Node.js 22 or newer and Docker with Compose, then follow the [prototype setup guide](prototype/README.md#run-locally). All prototype commands run from `prototype/` unless stated otherwise.

From the repository root, its existing automated suite can be run with:

```sh
npm ci --prefix prototype/backend --ignore-scripts
npm test --prefix prototype/backend
```

These tests cover the prototype. They do not validate the future React application, a Cloudflare deployment, database migrations, or backup restoration.

## Documentation

- [Rebuild scope](docs/REBUILD.md)
- [Contributing](CONTRIBUTING.md)
- [Deployment status](DEPLOYMENT.md)
- [Prototype architecture and local setup](prototype/README.md)
- [Prototype Docker guide](prototype/DEPLOYMENT.md)
- [Prototype database reference](prototype/database/README.md)
- [Prototype localization reference](prototype/docs/I18N.md)
- [Security policy](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

Public documentation uses portable application examples. Keep private deployment records, credentials, account identifiers, and environment-specific infrastructure details outside the repository.
