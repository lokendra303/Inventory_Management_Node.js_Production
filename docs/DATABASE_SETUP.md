# Database Setup

This project ships with a versioned migration system so you can go from a
clean machine to a running server with **one command** once MySQL and
Node.js are installed.

## 0. Prerequisites

- Node.js >= 18
- MySQL 8.x (or compatible; 5.7 works with minor caveats on JSON defaults)
- A MySQL user that can `CREATE DATABASE` and `CREATE TABLE` (e.g. `root` for
  local dev; a dedicated account for production)

## 1. Configure `.env`

```
cd Backend
cp .env.example .env
# then edit .env with your real credentials
```

The variables the migration runner reads:

| Variable        | Purpose                                           |
|-----------------|---------------------------------------------------|
| `DB_HOST`       | MySQL host (default `127.0.0.1`)                  |
| `DB_PORT`       | MySQL port (default `3306`)                       |
| `DB_USER`       | MySQL user with DDL privileges                    |
| `DB_PASSWORD`   | MySQL password                                    |
| `DB_NAME`       | Target database name (will be created if missing) |

Everything else (JWT secret, SMTP, platform admin seed, etc.) is listed in
`Backend/.env.example` with short inline docs.

## 2. Install deps

```
cd Backend
npm install

cd ../Frontend
npm install
```

## 3. Create + migrate the database

Still inside `Backend/`:

```
npm run db:setup
```

What that does:

1. Connects with your `.env` credentials (no `DB_NAME` required yet).
2. `CREATE DATABASE IF NOT EXISTS ${DB_NAME}`.
3. Creates a `schema_migrations` tracking table.
4. Applies every `Backend/src/database/migrations/*.sql` file in
   alphabetical order that has not been applied yet.
5. Records each migration (filename + SHA-256 checksum + timestamp) so it
   never runs twice.

The base file is `000_initial_schema.sql`: 82 tables, dumped from the
reference development database with FK-safe ordering. Everything after
that is an incremental, idempotent change.

## 4. Start the backend

```
npm run dev
```

The server will:
- Connect to `${DB_NAME}`.
- On first hit of any service that has a runtime `ensureSchema()` helper,
  create a handful of lazy tables (audit hooks, onboarding, etc.). These
  are also in `000_initial_schema.sql`, so they become no-ops.
- Auto-create the platform admin row from `PLATFORM_ADMIN_EMAIL` /
  `PLATFORM_ADMIN_PASSWORD` the first time someone hits the platform
  login endpoint.

## Day-2 commands

```
npm run db:migrate    # apply any migrations added since last run
npm run db:status     # show which migrations are applied / pending
npm run db:verify     # re-hash on-disk migrations; flag drift
```

## Authoring a new migration

1. Create a file named `NNN_short_description.sql` in
   `Backend/src/database/migrations/` where `NNN` sorts AFTER the highest
   number currently present (e.g. `010_add_invoice_terms.sql`).
2. Make it **idempotent** — use `CREATE TABLE IF NOT EXISTS`, and for
   `ALTER TABLE ADD COLUMN / ADD INDEX / ADD CONSTRAINT` wrap the
   statement in an `information_schema` guard so re-running is safe:

   ```sql
   SET @db := DATABASE();
   SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA=@db AND TABLE_NAME='items'
                   AND COLUMN_NAME='payment_terms');
   SET @sql := IF(@has=0,
     'ALTER TABLE items ADD COLUMN payment_terms VARCHAR(50) NULL',
     'SELECT 1');
   PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
   ```
3. Run `npm run db:migrate` locally to verify. Commit the file.

## Regenerating the base schema

If you ever need to refresh `000_initial_schema.sql` from the current
development database (e.g. after many small changes during a release),
run:

```
node scripts/extract-schema.js
```

Only do this on a release branch, and review the diff carefully — the
baseline is what every new install starts from.

## Troubleshooting

**"Access denied for user"** — your `.env` credentials are wrong or the
user lacks `CREATE DATABASE`. Either create the DB manually and re-run
`npm run db:migrate`, or grant the user DDL privileges for local dev.

**"Unknown database"** — run `npm run db:setup` (not `db:migrate`). The
`setup` command will create the database for you.

**"Migration failed (XYZ.sql): …"** — the migration runner aborts on the
first error without marking the failing file as applied. Fix the SQL
(the file is version-controlled), then re-run `npm run db:migrate`.

**Checksum drift** — someone edited a migration file AFTER it was
applied. Don't do that; add a new migration instead. `npm run db:verify`
flags this.
