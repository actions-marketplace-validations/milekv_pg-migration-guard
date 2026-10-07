# Security policy

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose credentials, database metadata, or a user's environment.

Use [GitHub private vulnerability reporting](https://github.com/milekv/pg-migration-guard/security/advisories/new). Include the affected version, a minimal reproduction, and the expected impact. Remove live credentials and private database details before submitting the report.

## Database access

The optional PostgreSQL connection is used only for catalog inspection. The client starts a read-only transaction, applies query timeouts, and does not send migration SQL to the database.

Use a dedicated role with only the permissions described in [docs/database-access.md](docs/database-access.md). Treat every database URL as a secret.
