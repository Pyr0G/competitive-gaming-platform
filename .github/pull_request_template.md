## Summary

Describe the concrete problem and resulting behavior. State whether this affects the rebuild, the preserved prototype, or documentation.

## Related issue

Link a related issue when applicable. Use `Closes #123` only when this change fully resolves it.

## Validation

List the checks performed and their results, including anything unverified. For prototype code or path changes, run `npm test --prefix prototype/backend` from the repository root on Node.js 22 or newer. For new application work, use the commands defined with its implementation.

For documentation, check formatting, links, section anchors, and setup instructions. For visual changes, include relevant desktop/mobile and account-state browser checks and screenshots.

## Data and deployment

Describe schema changes, configuration requirements, and deployment steps where applicable. Prototype database changes follow `prototype/DEPLOYMENT.md` and require separate upgrade and restore verification.

Keep credentials, private addresses, operator infrastructure, and personal data out of the description and evidence.
