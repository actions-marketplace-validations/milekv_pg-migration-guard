# Changelog

All notable changes are recorded in this file.

## 0.1.1 - 2026-10-07

- Documented CLI behavior, exit codes, checks, limitations, and GitHub Actions usage
- Added a least-privilege PostgreSQL role and database access reference
- Added contribution, security, and issue reporting guidance
- Corrected destructive-change detection so dropping a constraint is not reported as dropping data

## 0.1.0 - 2026-10-07

- Added SQL file and glob input
- Added text, JSON, and GitHub Actions output
- Added checks for blocking indexes, transaction-invalid concurrent indexes, table scans, table rewrites, immediate foreign key validation, destructive changes, and missing lock timeouts
- Added optional read-only PostgreSQL metadata for contextual severity
- Published the command-line package
