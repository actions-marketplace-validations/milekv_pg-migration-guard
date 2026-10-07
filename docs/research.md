# Problem validation

`pg-migration-guard` exists because migration safety depends on both SQL and the database receiving it.

## Repeated problems

The same production risks appear across unrelated migration ecosystems:

- [Prisma concurrent index support](https://github.com/prisma/prisma/issues/14456)
- [Drizzle concurrent index failure](https://github.com/drizzle-team/drizzle-orm/issues/860)
- [Kysely non-transactional migrations](https://github.com/kysely-org/kysely/issues/352)
- [TypeORM column recreation and data loss](https://github.com/typeorm/typeorm/issues/3357)
- [Flyway concurrent index hang](https://github.com/flyway/flyway/issues/3961)
- [golang-migrate concurrent index deadlock](https://github.com/golang-migrate/migrate/issues/960)

## Existing tools

The project does not try to replace mature tools:

- [Squawk](https://github.com/sbdchd/squawk) provides excellent static PostgreSQL migration linting.
- [Strong Migrations](https://github.com/ankane/strong_migrations) protects Rails applications.
- [pgroll](https://github.com/xataio/pgroll) provides a complete zero-downtime migration workflow.
- [pg-schema-diff](https://github.com/stripe/pg-schema-diff) plans safe schema transitions.
- [Atlas](https://github.com/ariga/atlas) provides broad schema management and database-aware analysis.

## Narrow gap

The initial scope is a small, framework-independent CLI that keeps existing migration files and adds optional production context. A static warning becomes materially more useful when it says that the affected table is 18 GB with roughly 40 million rows.

This gap is also reflected in [Squawk issue 197](https://github.com/sbdchd/squawk/issues/197), which requests row counts and table sizes in findings.

The project will remain local, read-only, explainable, and free. It will not execute migrations or require a hosted account.
