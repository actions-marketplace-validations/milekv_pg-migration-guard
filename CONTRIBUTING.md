# Contributing

Contributions should improve the accuracy of migration analysis or make the CLI easier to use in real repositories.

## Report a rule problem

For a false positive or missed risk, include:

- The smallest SQL example that reproduces the behavior
- The PostgreSQL version, when it matters
- The command you ran
- The actual result
- The result you expected and why

Remove table names and values that identify a private system.

## Local setup

```bash
npm install
npm test
npm run check
npm run build
```

Run the CLI against the included example:

```bash
npm run dev -- examples/risky.sql --fail-on never
```

## Pull requests

Keep each pull request focused on one problem. A rule change should include tests for the risky case, the safe case, and any syntax variants the implementation claims to support.

Before opening a pull request:

```bash
npm test
npm run check
npm run build
npm audit --audit-level=high
```

Documentation must describe current behavior. Do not document planned features as available.
