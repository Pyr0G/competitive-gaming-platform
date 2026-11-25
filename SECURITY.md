# Security Policy

## Report a vulnerability

Use GitHub's [private vulnerability reporting form](https://github.com/Pyr0G/competitive-gaming-platform/security/advisories/new). Do not publish vulnerability details, credentials, or private data in ordinary issues or pull requests.

Include the affected component and commit, expected boundary, potential impact, and a minimal reproduction using synthetic accounts and data you control.

Do not attach real passwords, session cookies, other people's messages or email addresses, private reports, account identifiers, or private deployment details. Describe sensitive evidence first so maintainers can arrange an appropriate private exchange.

## Application boundaries

CGP has a React interface, Worker API, and SQLite storage. Version 0.1.0 has an initial Cloudflare deployment and local development tooling. Hosted checks and their limits are recorded in [deployment status](docs/DEPLOYMENT.md). Production testing requires explicit authorization.

Review authentication, hashing, session issuance and revocation, CSRF and origins, input bounds, prepared SQL, request limits, authorization, participant-only messages, blocks, report evidence, administrative actions, dependencies, and accidental private-data disclosure.

Public profiles and search expose active player identifiers, usernames, bios, and join dates. Public team summaries expose team details and active roster information. Banned accounts are excluded from public rosters and member counts, and a banned captain's identifier and username are returned as null in public team responses. Team membership records are retained for restoration after an unban. Email and account preferences belong to the account owner. Chat history belongs to participants. Moderators review bounded report evidence, rather than browse arbitrary conversations. Administrator status changes require direct database interaction.

Passwords use native scrypt in a private Durable Object. CGP stores password hashes and hashed session tokens, uses HttpOnly cookies, validates write origins and authenticated CSRF tokens, and reads current permissions from SQLite. These controls require continued validation; they do not guarantee that every vulnerability has been eliminated.

## Responsible testing

Use the documented local environment, disposable data, and accounts you control. Obtain explicit authorization before testing hosting. Avoid accessing other people's data, disrupting services, or changing data without authorization.

Private infrastructure outside CGP is not a testing target. If repository content appears to disclose private information, report its location without attempting to use it.

## Release review and handling

Run Codex Security after implementation changes and resolve validated vulnerabilities before hosted-release approval. Preserve scope, revision, findings, and verification limits in review evidence. Local tests and scans do not verify production configuration or prove that no vulnerabilities exist.

Maintainers review reports privately and coordinate fixes and disclosure with the reporter. Review and resolution times depend on the issue and maintainer availability.
