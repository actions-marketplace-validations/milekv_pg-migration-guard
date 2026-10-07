# pg-migration-guard

[![CI](https://github.com/milekv/pg-migration-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/milekv/pg-migration-guard/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/pg-migration-guard)](https://www.npmjs.com/package/pg-migration-guard)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-16a34a)](LICENSE)

Preflight safety checks for PostgreSQL migrations.

`pg-migration-guard` reads SQL migration files, identifies operations that can block writes, rewrite large tables, or remove data, and explains a safer deployment pattern. It can optionally read table size and estimated row count from PostgreSQL to adjust finding severity to the database being changed.

It does not execute migration SQL.

## Example

```sql
SET lock_timeout = '3s';
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;
```

```text
! WARNING examples/readme.sql:2 [set-not-null]
   SET NOT NULL may scan the entire table on orders - lock: ACCESS EXCLUSIVE
   Validation can be slow on a populated table and the final change requires an ACCESS EXCLUSIVE lock.
   Fix: Add a CHECK (column IS NOT NULL) NOT VALID, validate it separately, then set NOT NULL.

0 errors, 1 warnings, 1 total findings.
```

The example is available at [examples/readme.sql](examples/readme.sql). Line numbers are preserved for terminal and GitHub Actions output.

## Install and run

Run without installing:

```bash
npx pg-migration-guard "migrations/**/*.sql"
```

Or add it to a project:

```bash
npm install --save-dev pg-migration-guard
npx pg-migration-guard "migrations/**/*.sql"
```

Requires Node.js 20 or newer.

## Add database context

Static analysis cannot distinguish a small development table from a table with millions of rows. Connected mode reads PostgreSQL catalog metadata and includes that context in the result:

```bash
npx pg-migration-guard "migrations/**/*.sql" \
  --database-url "postgres://migration_guard:password@localhost/app"
```

You can also set `DATABASE_URL` instead of passing the option. The connection is optional. When present, the CLI opens a read-only transaction and reads table size, estimated row count, and server version. See [database access](docs/database-access.md) for the exact queries and a restricted role example.

## Checks

| Rule | Detects | Default severity |
| --- | --- | --- |
| `index-not-concurrent` | Index creation that blocks writes on an existing table | warning |
| `concurrent-index-in-transaction` | `CREATE INDEX CONCURRENTLY` inside a transaction | error |
| `set-not-null` | `SET NOT NULL` operations that may scan a populated table | warning |
| `alter-column-type` | Column type changes that may rewrite a table | error |
| `volatile-default` | Volatile defaults that may rewrite existing rows | error |
| `foreign-key-validates-immediately` | Foreign keys that validate existing rows immediately | warning |
| `destructive-change` | Table and column removal | error |
| `missing-lock-timeout` | `ALTER TABLE` without a migration-level `lock_timeout` | info |

In connected mode, findings are escalated for tables at or above 1 GB or one million estimated rows. Tables at or above 10 GB or ten million estimated rows receive error severity.

## CLI

```text
Usage: pg-migration-guard [options] <paths...>

Arguments:
  paths                  SQL files or glob patterns

Options:
  -V, --version          output the version number
  --database-url <url>   read-only PostgreSQL connection URL (or set DATABASE_URL)
  --changed-since <ref>  check only SQL files changed since a Git reference
  --format <format>      text, json, or github (default: "text")
  --fail-on <level>      error, warning, or never (default: "error")
  -h, --help             display help for command
```

Examples:

```bash
pg-migration-guard migrations/001_add_index.sql
pg-migration-guard "migrations/**/*.sql" --format json
pg-migration-guard "migrations/**/*.sql" --format github --fail-on warning
pg-migration-guard "migrations/**/*.sql" --fail-on never
pg-migration-guard "migrations/**/*.sql" --changed-since origin/main
```

`--changed-since` intersects the requested paths with added, copied, modified, and renamed SQL files in `<ref>...HEAD`. This is useful when an existing repository has migration history that should not be re-reviewed on every pull request.

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | The configured failure threshold was not reached |
| `1` | At least one finding reached the configured failure threshold |
| `2` | Input, configuration, or execution error |

## GitHub Actions

```yaml
name: Migration safety

on:
  pull_request:
    paths:
      - "migrations/**/*.sql"

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx --yes pg-migration-guard@0.2.0 "migrations/**/*.sql" --changed-since origin/${{ github.base_ref }} --format github
```

Connected mode can use a repository secret:

```yaml
      - run: npx --yes pg-migration-guard@0.2.0 "migrations/**/*.sql" --changed-since origin/${{ github.base_ref }} --format github
        env:
          DATABASE_URL: ${{ secrets.MIGRATION_GUARD_DATABASE_URL }}
```

Use a dedicated read-only PostgreSQL role. Do not expose a production connection string in workflow files or logs.

## Scope and limitations

The current release targets PostgreSQL DDL that has known lock, rewrite, validation, or data-loss implications. Rules are deterministic regular-expression checks over parsed statements. This keeps results explainable, but it is not a complete PostgreSQL parser and cannot prove that a migration is safe.

Important boundaries:

- The CLI does not run, plan, or roll back migrations.
- It does not inspect application code or deployment order.
- Estimated row counts come from PostgreSQL statistics and may be stale.
- Dynamic SQL inside functions is outside the current analysis scope.
- A clean result means no current rule matched. It is not a substitute for review or rehearsal.

If a rule reports SQL incorrectly, open a [false-positive report](https://github.com/milekv/pg-migration-guard/issues/new?template=false_positive.yml) with a minimal migration.

## Development

```bash
npm install
npm test
npm run check
npm run build
npm run dev -- examples/risky.sql --fail-on never
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change. Product boundaries and source notes are in [docs/research.md](docs/research.md).

## Roadmap

The next work is driven by real migrations and reproducible false positives:

- Broader PostgreSQL statement coverage without reducing precision
- Configuration for rule severity and targeted ignores
- Reviewable migration plans for selected high-risk operations
- Rehearsal against disposable PostgreSQL databases

This project is a preflight check for migration tools such as Prisma, Drizzle, Flyway, and TypeORM. It is not a replacement migration framework.

## License

[MIT](LICENSE)
