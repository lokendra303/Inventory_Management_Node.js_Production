# Database migrations

## Adding or changing schema

1. **Create a new SQL file** in this folder. Do not edit past migrations that may already be applied in production.

2. **Name new files with a date prefix** (runs after legacy `000`–`020` files when sorted alphabetically):

   ```text
   YYYYMMDD_NNN_short_descriptive_name.sql
   ```

   - `YYYYMMDD` — date the change is introduced (e.g. `20260504`).
   - `NNN` — `001`, `002`, … if more than one migration ships the same day (always three digits).
   - Examples: `20260504_001_add_warehouse_zone.sql`, `20260504_002_alter_items_sku_index.sql`.

3. **Make migrations safe to re-run** where possible: `CREATE TABLE IF NOT EXISTS`, idempotent `ALTER` guards (see existing migrations that use `INFORMATION_SCHEMA` checks).

4. **Apply**: from `Backend/` with `.env` configured:

   ```bash
   node src/database/migrate.js migrate
   ```

5. **One-shot `mysql` installs (optional):** do **not** change `../full_install.sql`.

   Add a new file beside it, using the same date + sequence pattern:

   ```text
   full_install_YYYYMMDD_NNN_short_description.sql
   ```

   Example: `full_install_20260504_001_subscription_widgets.sql`

   Put only the **new** DDL in that file (idempotent `CREATE` / guarded `ALTER` when possible).

   Run order for a blank database:

   1. `full_install.sql` (frozen baseline)
   2. Then every `full_install_*.sql` in **alphabetical** order (shell glob `full_install_*.sql` does not include `full_install.sql`).

   Migrations in this folder remain the source of truth for `migrate.js`; install add-ons are for teams that import SQL by hand.

6. **Baseline dump:** if you maintain `000_initial_schema.sql` as a snapshot, update it when you change schema (regenerate or patch) so it stays consistent with migrations — that is separate from `full_install.sql`.

## Legacy filenames

Older files use `NNN_description.sql` (`000_initial_schema.sql`, `001_…`, …, `020_…`). **Do not rename** them if any database already recorded them in `schema_migrations`.

## Files starting with `_`

Underscore-prefixed files (e.g. `_notes.md`) are ignored by the runner.
