## Summary

Describe the problem and what changes for users or maintainers.

## Related issue

Link the issue, if applicable. Use `Closes #123` only if this PR fully resolves it.

## Validation

Describe what you checked and the results. Include commands or manual steps so reviewers can repeat them. If something was not tested, explain why.

For backend changes, run `npm test` from `backend` on Node 22 or newer. For frontend changes, include the pages, user flows, and browsers checked. For documentation or template changes, check formatting and links.

## Screenshots

For visual changes, add before and after screenshots. Otherwise, write "Not applicable".

## Database and deployment

Describe any database changes, configuration requirements, or manual deployment steps. Otherwise, write "Not applicable".

For database changes, update `database/schema.sql`, `database/seed.sql`, `database/upgrade.sql`, and `database/README.md`. Follow `DEPLOYMENT.md` for existing databases, including a backup and verified restoration before applying an upgrade.
