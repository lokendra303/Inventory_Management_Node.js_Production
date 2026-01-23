const db = require('./src/database/connection');

async function updateRoleColumn() {
  try {
    await db.connect();
    await db.query('ALTER TABLE users MODIFY COLUMN role VARCHAR(100) DEFAULT "user"');
    console.log('Role column updated successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error updating role column:', error);
    process.exit(1);
  }
}

updateRoleColumn();