# Contributing to CGP

CGP is being rebuilt as a new React application with SQLite storage and hosting entirely on Cloudflare. The new program stays in this repository. The previous application is preserved under [`prototype/`](prototype/) for reference, with limited reuse expected.

Read the [project status](README.md), [rebuild notes](docs/REBUILD.md), [working rules](AGENTS.md), and [security policy](SECURITY.md) before making changes. The new application has no runnable source or development commands yet.

## Discuss a change

Check existing issues and pull requests before opening an issue. State whether your report concerns the rebuild or the prototype, and include the relevant commit. Use the [bug report](.github/ISSUE_TEMPLATE/bug_report.md) or [feature request](.github/ISSUE_TEMPLATE/feature_request.md) template.

For bugs, provide reproduction steps, expected and actual behavior, and a sanitized example. For features, describe the player's or organizer's problem and observable acceptance criteria. Discuss substantial workflow changes and integrations before implementing them.

Report security vulnerabilities privately using [SECURITY.md](SECURITY.md). Remove credentials, session cookies, activation/reset links, personal data, private addresses, and environment-specific infrastructure details from shared material.

## Make focused changes

- Keep new CGP source in this repository, alongside the preserved prototype.
- Use the prototype to evaluate specific behavior or assets for reuse. Its framework, schema, and deployment model do not define the new architecture.
- Keep code simple and readable, without code comments.
- Keep maintained documentation in English and application copy in shared English and Polish catalogs.
- Update setup and behavior documentation with the implementation, and distinguish planned features from working flows.
- Use small commits with English messages prefixed by `frontend:`, `backend:`, `database:`, or `docs:`.

## Validate a change

For documentation, check formatting, links, section anchors, and commands. Include the checks performed and any unverified behavior in the pull request.

The prototype can be reproduced using [its setup guide](prototype/README.md#run-locally). From the repository root, its tests run with:

```sh
npm ci --prefix prototype/backend --ignore-scripts
npm test --prefix prototype/backend
```

Run that suite for changes to prototype code or paths. Follow [prototype/CONTRIBUTING.md](prototype/CONTRIBUTING.md) for browser checks and database validation when changing the reference application. The suite does not verify database upgrades, backup restoration, or a live deployment.

New application work must include the development and validation commands appropriate to its actual implementation. Prototype test results do not establish correctness of the new program.

## Submit a pull request

Use the [pull request template](.github/pull_request_template.md). Explain the concrete problem, resulting behavior, scope, and validation. Identify whether the change affects the rebuild, the prototype, or documentation. Include screenshots for visual changes and describe database or deployment steps when applicable.

Use generic application examples in public output. Private operator records and infrastructure details belong outside the repository.
