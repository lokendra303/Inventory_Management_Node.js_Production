const db = require('./src/database/connection');

async function removeSubdomainColumn() {
  try {
    // Remove subdomain column from institutions table
    await db.query('ALTER TABLE institutions DROP COLUMN subdomain');
    console.log('Subdomain column removed from institutions table');
    
    // Remove any indexes on subdomain
    try {
      await db.query('DROP INDEX idx_subdomain ON institutions');
      console.log('Subdomain index removed');
    } catch (error) {
      console.log('No subdomain index found');
    }
    
  } catch (error) {
    console.error('Error removing subdomain column:', error);
  }
}

removeSubdomainColumn();