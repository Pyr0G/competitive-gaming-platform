# Deployment

## New application

The new CGP application will use React and SQLite and will be hosted entirely on Cloudflare. It will be developed and released from this repository.

The rebuild has not yet added runnable source, a new database schema, Cloudflare configuration, or deployment commands. There is no replacement deployment documented or verified in this revision. See the [rebuild notes](docs/REBUILD.md) for the current scope.

Deployment documentation will be added with the implementation and will cover local development, environment bindings and secrets, schema changes, release validation, and recovery.

## Preserved prototype

The previous hosted deployment is retired. Its source and configuration are retained in [`prototype/`](prototype/) for reference and optional reproduction.

- [Run the prototype locally](prototype/README.md#run-locally).
- [Reproduce its Docker application and PostgreSQL containers](prototype/DEPLOYMENT.md).
- [Understand its schema, initialization, and manual upgrades](prototype/database/README.md).

Run Docker commands from `prototype/` so their build context and relative paths resolve correctly. These files describe the previous application and are not a Cloudflare deployment procedure.
