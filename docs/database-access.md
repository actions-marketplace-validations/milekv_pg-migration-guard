# Database access

Database access is optional. Without it, `pg-migration-guard` performs static analysis only.

## Recommended role

Create a dedicated PostgreSQL role instead of reusing an application or migration account. Replace the database name and password before running these statements:

```sql
CREATE ROLE migration_guard LOGIN PASSWORD 'replace-with-a-secret';
ALTER ROLE migration_guard SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE app TO migration_guard;
GRANT USAGE ON SCHEMA public TO migration_guard;
```

The current catalog queries do not require access to application rows. Test the role in the same environment in which the CLI will run because managed PostgreSQL services can apply additional policies.

## What the client does

When `--database-url` or `DATABASE_URL` is present, the client:

1. Connects with `application_name` set to `pg-migration-guard`.
2. Applies a 5 second statement timeout and a 7 second client query timeout.
3. Starts `BEGIN READ ONLY`.
4. Reads the PostgreSQL server version.
5. Reads relation names, total relation size, and estimated row count from `pg_class` and `pg_namespace`.
6. Rolls back the read-only transaction and closes the connection.

The migration SQL is read from local files and is never sent to PostgreSQL.

## GitHub Actions

Store the connection URL as an Actions secret named `MIGRATION_GUARD_DATABASE_URL`:

```yaml
- name: Check PostgreSQL migrations
  run: npx --yes pg-migration-guard@0.2.0 "migrations/**/*.sql" --changed-since origin/${{ github.base_ref }} --format github
  env:
    DATABASE_URL: ${{ secrets.MIGRATION_GUARD_DATABASE_URL }}
```

Use a network path intended for CI and restrict the role at the PostgreSQL and network layers. Do not print the URL or include it directly in the workflow.
