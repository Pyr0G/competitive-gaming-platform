# Security Policy

## Report a vulnerability

Use GitHub's [private vulnerability reporting form](https://github.com/Pyr0G/competitive-gaming-platform/security/advisories/new) to contact the repository maintainers. Avoid public issues or pull requests containing vulnerability details or private information.

Include the affected component, commit, reproduction steps using accounts and data you control, expected security boundary, and potential impact. State whether the report concerns the new application or the preserved prototype.

Do not include passwords, API keys, session cookies, activation/reset tokens, other people's data, or private deployment details. If evidence requires sensitive material, describe its type and affected location first so maintainers can arrange an appropriate private exchange.

## Project status and scope

CGP is being rebuilt as a new React application with SQLite storage and hosting entirely on Cloudflare. The new program has not been implemented in this revision. The previous hosted deployment is retired, and its source is retained under [`prototype/`](prototype/) for reference.

Reports may concern source, application behavior, dependencies, database access, deployment configuration, or accidental disclosure maintained in this repository. The prototype is reference software rather than a supported hosted service. Always identify the relevant version or commit.

## Responsible testing

Use a local environment, disposable data, and accounts you control. Obtain permission before testing any hosted deployment. Avoid accessing other people's data, disrupting services, or changing data without authorization.

Private infrastructure outside the application is not a testing target. If repository content appears to disclose private information, report the file or public reference without attempting to use it.

## Handling reports

Maintainers review reports and coordinate fixes and disclosure with the reporter. Response and resolution times depend on the issue and maintainer availability.
