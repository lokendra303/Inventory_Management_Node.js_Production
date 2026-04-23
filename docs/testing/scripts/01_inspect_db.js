/* eslint-disable */
// Inspect the local DB to pick a test account.
// Run with: node docs/testing/scripts/01_inspect_db.js

const path = require('path');
const BACKEND = path.resolve(__dirname, '../../../Backend');
const dotenv = require(path.join(BACKEND, 'node_modules/dotenv'));
dotenv.config({ path: path.join(BACKEND, '.env') });

const mysql = require(path.join(BACKEND, 'node_modules/mysql2/promise'));

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const show = async (label, sql, params = []) => {
    try {
      const [rows] = await pool.execute(sql, params);
      console.log(`\n=== ${label} (${rows.length}) ===`);
      rows.slice(0, 10).forEach((r) => console.log(r));
    } catch (e) {
      console.log(`\n=== ${label} -- ERROR ${e.message}`);
    }
  };

  await show('institutions', `SELECT id, name, status, created_at FROM institutions ORDER BY created_at DESC LIMIT 10`);
  await show(
    'institution_users (owners/recent)',
    `SELECT id, institution_id, email, role, status, created_at
       FROM institution_users
      ORDER BY created_at DESC LIMIT 10`
  );
  await show('warehouses count per institution', `SELECT institution_id, COUNT(*) c FROM warehouses GROUP BY institution_id`);
  await show('items count per institution', `SELECT institution_id, COUNT(*) c FROM items GROUP BY institution_id`);
  await show('vendors count per institution', `SELECT institution_id, COUNT(*) c FROM vendors GROUP BY institution_id`);
  await show('customers count per institution', `SELECT institution_id, COUNT(*) c FROM customers GROUP BY institution_id`);
  await show('purchase_orders count per institution', `SELECT institution_id, COUNT(*) c FROM purchase_orders GROUP BY institution_id`);

  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
