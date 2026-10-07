# pg-migration-guard

[![CI](https://github.com/milekv/pg-migration-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/milekv/pg-migration-guard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-16a34a)](LICENSE)

Database-aware safety checks for PostgreSQL migrations.

Static linters can identify risky SQL syntax. They cannot tell whether the affected table has 200 rows or 200 million. `pg-migration-guard` combines migration analysis with optional, read-only PostgreSQL metadata so the same operation can receive a different severity based on its real production impact.

## Quick start

```bash
npx pg-migration-guard "migrations/**/*.sql"
```

Until the first npm release, run the public repository directly:

```bash
npx github:milekv/pg-migration-guard "migrations/**/*.sql"
```

Add database context without granting write access:

```bash
DATABASE_URL="postgres://readonly:password@localhost/app" \
  npx pg-migration-guard "migrations/**/*.sql"
```

The database connection is optional. When provided, the CLI starts a read-only transaction and reads only PostgreSQL catalog metadata. It never executes migration SQL.

## What it detects

- Index creation that blocks writes.
- `CREATE INDEX CONCURRENTLY` inside a transaction.
- `SET NOT NULL` operations that scan populated tables.
- Type changes that may rewrite a table.
- Volatile defaults that can rewrite existing rows.
- Foreign keys that validate all existing rows immediately.
- Destructive table and column removal.
- Missing `lock_timeout` protection.

Connected mode enriches findings with table size and estimated row count. Operations against tables above 1 GB or one million rows are escalated. Tables above 10 GB or ten million rows receive the highest severity.

## Output formats

Human-readable output:

```bash
pg-migration-guard migrations/*.sql
```

Machine-readable JSON:

```bash
pg-migration-guard migrations/*.sql --format json
```

GitHub Actions annotations:

```bash
pg-migration-guard migrations/*.sql --format github
```

Choose when CI should fail:

```bash
pg-migration-guard migrations/*.sql --fail-on error
pg-migration-guard migrations/*.sql --fail-on warning
pg-migration-guard migrations/*.sql --fail-on never
```

## Security model

- Migration files are analyzed locally.
- No telemetry and no hosted service.
- The optional database connection uses `BEGIN READ ONLY`.
- Catalog queries have a five-second statement timeout.
- The migration itself is never executed.

Use a dedicated read-only PostgreSQL role in CI.

## Development

```bash
npm install
npm test
npm run check
npm run build
npm run dev -- examples/risky.sql
```

## Status

This is an early release focused on PostgreSQL DDL with predictable lock and rewrite behavior. Findings are intentionally explainable and include the safer deployment pattern.

The research and product boundary are documented in [docs/research.md](docs/research.md).

## Roadmap

The project is designed as a safety layer that works before Prisma, Drizzle, Flyway, TypeORM, or another migration runner. It is not a replacement migration framework.

1. `check` - detect lock, rewrite, scan, compatibility, and data-loss risks.
2. `plan` - produce a reviewable, safer sequence of PostgreSQL statements.
3. `verify` - rehearse migrations against a disposable database and report duration and lock behavior.
4. `apply` - considered only after the first three stages are reliable and used in real repositories.

The next milestone is five external repositories running `check` in CI. New features will be driven by false-positive reports and real migrations rather than rule count.

## License

MIT
