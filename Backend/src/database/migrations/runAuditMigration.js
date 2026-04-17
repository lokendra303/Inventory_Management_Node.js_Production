const fs = require('fs');
const path = require('path');
const db = require('../connection');
const logger = require('../../utils/logger');

async function runMigration() {
  try {
    logger.info('Starting audit_logs table migration...');
    
    // Read the SQL migration file
    const sqlFile = path.join(__dirname, 'create_audit_logs_table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      try {
        await db.query(statement.trim());
        logger.info('Executed SQL statement successfully');
      } catch (error) {
        // Log but don't fail on duplicate table/index errors
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
            error.code === 'ER_DUP_KEYNAME' ||
            error.errno === 1050 || 
            error.errno === 1061) {
          logger.info('Table or index already exists, skipping...');
        } else {
          logger.error('Migration statement failed:', { error: error.message, statement: statement.substring(0, 100) });
          throw error;
        }
      }
    }
    
    logger.info('Audit logs table migration completed successfully');
    
    // Test the table by inserting a sample record
    const testId = require('uuid').v4();
    await db.query(
      `INSERT INTO audit_logs (id, institution_id, action, entity_type, description, created_at) 
       VALUES (?, 'test-institution', 'migration', 'system', 'Audit system initialization', NOW())`,
      [testId]
    );
    
    // Clean up test record
    await db.query('DELETE FROM audit_logs WHERE id = ?', [testId]);
    
    logger.info('Audit logs table test successful');
    
  } catch (error) {
    logger.error('Migration failed:', { error: error.message });
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };