# CGP rebuild

## Status and scope

CGP is being rebuilt as a completely new program in this repository. The target is a React interface, SQLite storage, and hosting entirely on Cloudflare. The previous hosted deployment is retired.

The new application's source, database schema, runtime configuration, and deployment workflow have not been added yet. A runnable prototype exists under [`prototype/`](../prototype/); its implementation does not represent progress on the new application.

## Using the prototype

The prototype preserves the previous application, including its assets, database scripts, tests, and original product brief. Use it to understand the earlier player experience and evaluate specific behavior or assets for reuse. Most of the application will be written again.

Review any reused component against the new architecture and its actual requirements. Existing Express routes, PostgreSQL migrations, browser session behavior, and Docker settings are reference material, not contracts for the new program.

The [prototype README](../prototype/README.md) records what works and what is simulated or incomplete. The [original requirements](../prototype/REQUIREMENTS.md) and [brief](../prototype/brief.pdf) are historical product material; neither is an acceptance specification for the rebuild.

## Target architecture

| Component | Direction | Implementation status |
| --- | --- | --- |
| User interface | React | Not added |
| Application hosting and server logic | Cloudflare | Not added |
| Persistent data | SQLite on Cloudflare | New schema and integration not added |
| Local development, tests, and releases | Defined alongside the new source | Not added |

[Cloudflare D1](https://developers.cloudflare.com/d1/) provides managed storage with SQLite SQL semantics and is an available fit for the storage target. The final Cloudflare service layout and bindings will be documented when implemented.

## Implementation expectations

- Keep the new application in this repository, alongside the preserved prototype.
- Define the new source layout and repeatable development commands with the first implementation.
- Document each feature when its complete workflow works, including persistence where required.
- Define and test authentication, authorization, validation, and request limits for the new runtime.
- Evaluate English and Polish copy, accessibility, and responsive behavior as part of the new interface.
- Design the SQLite schema and migrations for the new program. Existing PostgreSQL scripts are not SQLite migrations.
- Document any data import separately and test it with disposable or sanitized data before use.
- Add Cloudflare deployment instructions with the actual configuration and release checks.

## Public documentation

Explain application behavior, configuration, and reproducible setup. Use generic example domains and placeholders. Keep credentials, private addresses, machine identities, account identifiers, deployment-specific paths, and unrelated infrastructure or security configuration out of files, screenshots, issue text, and commit messages.

Maintain the distinction between intended behavior and verified implementation throughout the rebuild.
