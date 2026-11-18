# Working on CGP

## Project state

CGP is being created as a completely new React application with SQLite storage, hosted entirely on Cloudflare. Keep the new application in this repository. The previous application and its files are preserved under `prototype/` for reference, with only selected parts expected to be reused.

No new application source, schema, or Cloudflare deployment workflow has been added yet. Do not describe prototype functionality as implemented in the rebuild or turn a documentation task into implementation of the new application.

## Read first

- [README.md](README.md): project status and repository layout.
- [docs/REBUILD.md](docs/REBUILD.md): rebuild scope and intended architecture.
- [CONTRIBUTING.md](CONTRIBUTING.md): contribution and validation rules.
- [DEPLOYMENT.md](DEPLOYMENT.md): deployment status.
- [SECURITY.md](SECURITY.md): private vulnerability reporting and responsible testing.

When changing reference files, also read [prototype/AGENTS.md](prototype/AGENTS.md) and the relevant prototype guides. Their Node.js, Express, PostgreSQL, and Docker rules apply to that reference application, not automatically to the new program.

## Public repository rules

- Keep public content limited to application behavior and portable setup instructions. Do not include private infrastructure topology, addresses, machine or account identifiers, deployment-specific paths, credentials, or unrelated security configuration.
- Use generic example domains, synthetic data, and placeholders. Check documentation, templates, screenshots, commit messages, and published history as well as code.
- Keep the prototype available under `prototype/`. Add new CGP source alongside it in this repository when implementation is requested.
- Clearly distinguish plans, demonstration behavior, and verified functionality. Do not invent runnable commands before their configuration exists.
- Keep code simple and readable, without code comments. Keep maintained repository guidance and contribution documents in English.
- Keep application-owned copy and accessible labels in shared English and Polish catalogs when implementing the new interface. English is the fallback. Preserve the reference application's localization rules when changing it.
- Use small commits with English messages prefixed by `frontend:`, `backend:`, `database:`, or `docs:`.

## Validation

For documentation changes, check formatting, file links, section anchors, and commands against the actual layout. For changes to the prototype or its paths, run `npm test --prefix prototype/backend` from the repository root on Node.js 22 or newer. The prototype tests use database/mail mocks and a local TLS server; they do not verify a live deployment, migrations, or restoration.

Define the new application's development and validation commands alongside its implementation. Keep its checks separate from prototype checks and deployment verification.
