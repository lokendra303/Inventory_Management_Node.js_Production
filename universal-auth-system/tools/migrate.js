#!/usr/bin/env node

// auto-migrate-existing-project.js
// Automatically adds auth to any existing Node.js project

const mysql = require('mysql2/promise');
const DatabaseMigrator = require('./universal-auth-package/lib/DatabaseMigrator');
require('dotenv').config();

async function migrateExistingProject() {
  console.log('🚀 Universal Auth - Auto Migration Tool\n');
  console.log('This will add authentication to your existing project without breaking anything.\n');

  try {
    // Connect to database
    const db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'your_app_db'
    });

    console.log('✅ Connected to database:', process.env.DB_NAME);

    // Initialize migrator
    const migrator = new DatabaseMigrator(db);

    // Run auto-migration
    await migrator.autoMigrate();

    // Add missing fields to existing tables
    await migrator.addMissingFields();

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 What was done:');
    console.log('✅ Created auth tables (institutions, users, temp_access_tokens)');
    console.log('✅ Added institution_id to existing tables');
    console.log('✅ Migrated existing data to default institution');
    console.log('✅ Added missing fields for full auth support');

    console.log('\n🚀 Next steps:');
    console.log('1. Add auth routes to your app:');
    console.log('   const { OptionalAuth } = require("./universal-auth-package");');
    console.log('   const auth = new OptionalAuth({ enabled: true, jwtSecret: "secret", database: db });');
    console.log('   app.use("/api/auth", auth.getAuthRoutes());');
    console.log('\n2. Protect your routes:');
    console.log('   app.use("/api/protected", auth.authenticate());');
    console.log('\n3. Test the auth system:');
    console.log('   node auth-system-test.js');

    await db.end();

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check database connection in .env file');
    console.log('2. Ensure database exists');
    console.log('3. Verify user has CREATE/ALTER permissions');
    process.exit(1);
  }
}

// Check if this is being run directly
if (require.main === module) {
  migrateExistingProject();
}

module.exports = migrateExistingProject;