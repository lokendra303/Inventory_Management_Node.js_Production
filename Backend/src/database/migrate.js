#!/usr/bin/env node
/**
 * Database setup + migration runner for a fresh or existing MySQL instance.
 *
 *   node src/database/migrate.js <command>
 *
 * Commands:
 *   setup     Create the database (if missing) and apply all pending
 *             migrations. Use this on a fresh machine.
 *   migrate   Apply all pending migrations against the existing database.
 *   status    Print which migrations are applied and which are pending.
 *   verify    Re-check checksums of applied migrations (detect tampering).
 *
 * Conventions:
 *   - Migration files live in `Backend/src/database/migrations/*.sql`.
 *   - Filenames that sort alphabetically run in that order. Use a three-
 *     digit prefix so `010_…` sorts after `009_…`.
 *   - `000_initial_schema.sql` is the baseline, dumped from the live DB.
 *     Every migration after it should be idempotent so running against
 *     an existing legacy DB (one that was set up before this runner)
 *     is a safe no-op for already-applied changes.
 *   - Tracking lives in the `schema_migrations` table, which this runner
 *     creates automatically on first use.
 *
 * No dependency on external migration frameworks — keeps Node + mysql2 only.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATIONS_TABLE = 'schema_migrations';

const LOG = {
  info: (msg) => process.stdout.write(`  ${msg}\n`),
  ok:   (msg) => process.stdout.write(`  \x1b[32mOK\x1b[0m  ${msg}\n`),
  warn: (msg) => process.stdout.write(`  \x1b[33mWARN\x1b[0m ${msg}\n`),
  err:  (msg) => process.stderr.write(`  \x1b[31mERR\x1b[0m  ${msg}\n`),
  head: (msg) => process.stdout.write(`\n\x1b[1m${msg}\x1b[0m\n`),
};

function dbConfigFromEnv({ withDatabase }) {
  const cfg = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  };
  if (!cfg.user) throw new Error('DB_USER is not set in .env');
  if (withDatabase) {
    if (!process.env.DB_NAME) throw new Error('DB_NAME is not set in .env');
    cfg.database = process.env.DB_NAME;
  }
  return cfg;
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('_'))
    .sort();
}

function checksum(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

async function ensureDatabaseExists() {
  const cfg = dbConfigFromEnv({ withDatabase: false });
  const name = process.env.DB_NAME;
  const conn = await mysql.createConnection(cfg);
  try {
    const [rows] = await conn.query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [name]
    );
    if (rows.length === 0) {
      await conn.query(
        `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      LOG.ok(`Created database \`${name}\``);
    } else {
      LOG.info(`Database \`${name}\` already exists`);
    }
  } finally {
    await conn.end();
  }
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      filename     VARCHAR(255) NOT NULL PRIMARY KEY,
      checksum     CHAR(64)     NOT NULL,
      applied_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      duration_ms  INT          NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getAppliedMigrations(conn) {
  const [rows] = await conn.query(
    `SELECT filename, checksum, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY filename ASC`
  );
  const map = new Map();
  for (const r of rows) map.set(r.filename, r);
  return map;
}

function readMigrationFile(filename) {
  const fullPath = path.join(MIGRATIONS_DIR, filename);
  let sql = fs.readFileSync(fullPath, 'utf8');
  if (sql.charCodeAt(0) === 0xFEFF) sql = sql.slice(1);
  return sql;
}

async function applyMigration(conn, filename) {
  const sql = readMigrationFile(filename);
  const sum = checksum(sql);
  const started = Date.now();
  try {
    await conn.query(sql);
  } catch (err) {
    throw new Error(`Migration failed (${filename}): ${err.message}`);
  }
  const duration = Date.now() - started;
  await conn.query(
    `INSERT INTO ${MIGRATIONS_TABLE} (filename, checksum, duration_ms) VALUES (?, ?, ?)`,
    [filename, sum, duration]
  );
  return duration;
}

async function runMigrate() {
  const cfg = dbConfigFromEnv({ withDatabase: true });
  const conn = await mysql.createConnection(cfg);
  try {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedMigrations(conn);
    const files = listMigrationFiles();

    if (files.length === 0) {
      LOG.warn('No migration files found');
      return;
    }

    const pending = files.filter((f) => !applied.has(f));

    LOG.head('Applying migrations');
    if (pending.length === 0) {
      LOG.ok('All migrations already applied — database is up to date');
      return;
    }

    let applied_count = 0;
    for (const f of pending) {
      const ms = await applyMigration(conn, f);
      LOG.ok(`${f} (${ms} ms)`);
      applied_count++;
    }
    LOG.head(`Applied ${applied_count} migration(s)`);
  } finally {
    await conn.end();
  }
}

async function runSetup() {
  LOG.head(`Database setup for \`${process.env.DB_NAME}\` at ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  await ensureDatabaseExists();
  await runMigrate();
  LOG.head('Setup complete');
  LOG.info('Start the server with: npm run dev');
}

async function runStatus() {
  const cfg = dbConfigFromEnv({ withDatabase: true });
  const conn = await mysql.createConnection(cfg);
  try {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedMigrations(conn);
    const files = listMigrationFiles();

    LOG.head(`Migration status (db=${process.env.DB_NAME})`);
    if (files.length === 0) {
      LOG.warn('No migration files on disk');
    }
    for (const f of files) {
      if (applied.has(f)) {
        const row = applied.get(f);
        const when = new Date(row.applied_at).toISOString();
        LOG.ok(`applied ${f}  (${when})`);
      } else {
        LOG.warn(`pending  ${f}`);
      }
    }
    const orphanApplied = [...applied.keys()].filter((a) => !files.includes(a));
    for (const f of orphanApplied) {
      LOG.warn(`applied but file missing: ${f}`);
    }
  } finally {
    await conn.end();
  }
}

async function runVerify() {
  const cfg = dbConfigFromEnv({ withDatabase: true });
  const conn = await mysql.createConnection(cfg);
  try {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedMigrations(conn);
    const files = listMigrationFiles();

    LOG.head('Verifying migration checksums');
    let bad = 0;
    for (const f of files) {
      if (!applied.has(f)) continue;
      const onDisk = checksum(readMigrationFile(f));
      const inDb = applied.get(f).checksum;
      if (onDisk !== inDb) {
        LOG.err(`${f} — checksum drift (on-disk=${onDisk.slice(0, 8)}…, recorded=${inDb.slice(0, 8)}…)`);
        bad++;
      } else {
        LOG.ok(`${f}`);
      }
    }
    if (bad > 0) {
      LOG.err(`${bad} migration(s) have drifted from their recorded checksum`);
      process.exitCode = 2;
    } else {
      LOG.ok('All applied migrations match their on-disk checksums');
    }
  } finally {
    await conn.end();
  }
}

async function main() {
  const cmd = (process.argv[2] || 'migrate').trim();
  try {
    if (cmd === 'setup')       await runSetup();
    else if (cmd === 'migrate') await runMigrate();
    else if (cmd === 'status')  await runStatus();
    else if (cmd === 'verify')  await runVerify();
    else {
      process.stderr.write(`Unknown command: ${cmd}\n`);
      process.stderr.write('Usage: node src/database/migrate.js <setup|migrate|status|verify>\n');
      process.exit(1);
    }
  } catch (err) {
    LOG.err(err.message);
    if (process.env.DEBUG) process.stderr.write(err.stack + '\n');
    process.exit(1);
  }
}

main();
