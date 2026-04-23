#!/usr/bin/env node
/**
 * Dev utility: regenerate migrations/000_initial_schema.sql from the live DB.
 *
 *   node Backend/scripts/extract-schema.js
 *
 * Writes via fs.writeFileSync (UTF-8, no BOM), which PowerShell's `>` would
 * otherwise prepend.
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const OUT = path.join(__dirname, '..', 'src', 'database', 'migrations', '000_initial_schema.sql');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    const [tableRows] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME`,
      [process.env.DB_NAME]
    );
    const tables = tableRows
      .map((r) => r.TABLE_NAME)
      .filter((t) => t !== 'schema_migrations'); // never bake the tracker into the baseline

    const [fkRows] = await conn.query(
      `SELECT TABLE_NAME, REFERENCED_TABLE_NAME
         FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [process.env.DB_NAME]
    );

    const deps = new Map(tables.map((t) => [t, new Set()]));
    for (const { TABLE_NAME, REFERENCED_TABLE_NAME } of fkRows) {
      if (TABLE_NAME === REFERENCED_TABLE_NAME) continue;
      if (deps.has(TABLE_NAME) && tables.includes(REFERENCED_TABLE_NAME)) {
        deps.get(TABLE_NAME).add(REFERENCED_TABLE_NAME);
      }
    }

    const ordered = [];
    const visiting = new Set();
    const visited = new Set();
    const visit = (t) => {
      if (visited.has(t) || visiting.has(t)) return;
      visiting.add(t);
      for (const d of deps.get(t) || []) visit(d);
      visiting.delete(t);
      visited.add(t);
      ordered.push(t);
    };
    for (const t of tables) visit(t);

    const header = [
      '-- =====================================================================',
      '-- 000_initial_schema.sql',
      '-- Baseline schema for fresh installs, dumped from the live development',
      '-- database. All statements use CREATE TABLE IF NOT EXISTS so running',
      '-- this file on an existing database is a safe no-op.',
      '--',
      '-- Regenerate with:  node Backend/scripts/extract-schema.js',
      '-- Do NOT put data or real-tenant rows here. Schema only.',
      `-- Generated: ${new Date().toISOString()}`,
      '-- =====================================================================',
      '',
      'SET FOREIGN_KEY_CHECKS = 0;',
      '',
    ];

    const body = [];
    for (const t of ordered) {
      const [ddl] = await conn.query(`SHOW CREATE TABLE \`${t}\``);
      const create = ddl[0]['Create Table']
        .replace(/^CREATE TABLE /, 'CREATE TABLE IF NOT EXISTS ')
        .replace(/\s*AUTO_INCREMENT=\d+\s*/g, ' ')
        .replace(/\s+DEFINER=`[^`]+`@`[^`]+`/g, '')
        .trim();
      body.push(`-- -----------------------------------------------------`);
      body.push(`-- Table: ${t}`);
      body.push(`-- -----------------------------------------------------`);
      body.push(create + ';');
      body.push('');
    }

    const footer = ['SET FOREIGN_KEY_CHECKS = 1;', ''];
    const out = [...header, ...body, ...footer].join('\n');
    fs.writeFileSync(OUT, out, { encoding: 'utf8' });
    process.stdout.write(`Wrote ${OUT}\n`);
    process.stdout.write(`  tables: ${ordered.length}\n`);
  } finally {
    await conn.end();
  }
})().catch((err) => {
  process.stderr.write(`extract-schema failed: ${err.message}\n`);
  process.exit(1);
});
