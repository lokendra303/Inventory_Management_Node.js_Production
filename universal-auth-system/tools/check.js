#!/usr/bin/env node

// check-database-compatibility.js
// Analyzes existing database and shows what needs to be migrated

const mysql = require('mysql2/promise');
require('dotenv').config();

class CompatibilityChecker {
  constructor(database) {
    this.db = database;
  }

  async checkCompatibility() {
    console.log('🔍 Analyzing existing database structure...\n');

    const report = {
      existingTables: [],
      missingAuthTables: [],
      tablesNeedinginstitutionId: [],
      missingFields: {},
      recommendations: []
    };

    // Get existing tables
    report.existingTables = await this.getExistingTables();
    console.log('📋 Found tables:', report.existingTables.join(', '));

    // Check for auth tables
    const authTables = ['institutions', 'users', 'temp_access_tokens'];
    report.missingAuthTables = authTables.filter(table => !report.existingTables.includes(table));

    // Check which tables need institution_id
    for (const table of report.existingTables) {
      if (!authTables.includes(table)) {
        const hasinstitutionId = await this.columnExists(table, 'institution_id');
        if (!hasinstitutionId) {
          report.tablesNeedinginstitutionId.push(table);
        }
      }
    }

    // Check for missing fields in existing tables
    await this.checkMissingFields(report);

    // Generate recommendations
    this.generateRecommendations(report);

    // Display report
    this.displayReport(report);

    return report;
  }

  async getExistingTables() {
    const [rows] = await this.db.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    return rows.map(row => row.table_name || row.TABLE_NAME);
  }

  async columnExists(tableName, columnName) {
    const [rows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
      [tableName, columnName]
    );
    return rows[0].count > 0;
  }

  async checkMissingFields(report) {
    const expectedFields = {
      users: ['mobile', 'address', 'city', 'state', 'country', 'postal_code', 'date_of_birth', 'gender', 'department', 'designation', 'permissions', 'warehouse_access', 'last_login'],
      items: ['institution_id', 'created_by'],
      inventory: ['institution_id', 'created_by'],
      products: ['institution_id', 'created_by'],
      orders: ['institution_id', 'created_by']
    };

    for (const [tableName, fields] of Object.entries(expectedFields)) {
      if (report.existingTables.includes(tableName)) {
        const missingFields = [];
        for (const field of fields) {
          if (!await this.columnExists(tableName, field)) {
            missingFields.push(field);
          }
        }
        if (missingFields.length > 0) {
          report.missingFields[tableName] = missingFields;
        }
      }
    }
  }

  generateRecommendations(report) {
    if (report.missingAuthTables.length > 0) {
      report.recommendations.push({
        type: 'critical',
        message: `Missing auth tables: ${report.missingAuthTables.join(', ')}`,
        action: 'Run auto-migration to create these tables'
      });
    }

    if (report.tablesNeedinginstitutionId.length > 0) {
      report.recommendations.push({
        type: 'important',
        message: `Tables need institution_id: ${report.tablesNeedinginstitutionId.join(', ')}`,
        action: 'Add institution_id column for multi-institution support'
      });
    }

    if (Object.keys(report.missingFields).length > 0) {
      report.recommendations.push({
        type: 'optional',
        message: 'Some tables have missing optional fields',
        action: 'Add missing fields for full feature support'
      });
    }

    if (report.recommendations.length === 0) {
      report.recommendations.push({
        type: 'success',
        message: 'Database is compatible with Universal Auth!',
        action: 'You can proceed with integration'
      });
    }
  }

  displayReport(report) {
    console.log('\n📊 COMPATIBILITY REPORT\n');

    // Existing structure
    console.log('🗃️  Current Database:');
    console.log(`   Tables: ${report.existingTables.length}`);
    console.log(`   Auth tables: ${3 - report.missingAuthTables.length}/3`);
    console.log(`   Multi-institution ready: ${report.existingTables.length - report.tablesNeedinginstitutionId.length}/${report.existingTables.length}`);

    // Missing auth tables
    if (report.missingAuthTables.length > 0) {
      console.log('\n❌ Missing Auth Tables:');
      report.missingAuthTables.forEach(table => {
        console.log(`   • ${table}`);
      });
    }

    // Tables needing institution_id
    if (report.tablesNeedinginstitutionId.length > 0) {
      console.log('\n⚠️  Tables Needing institution_id:');
      report.tablesNeedinginstitutionId.forEach(table => {
        console.log(`   • ${table}`);
      });
    }

    // Missing fields
    if (Object.keys(report.missingFields).length > 0) {
      console.log('\n📝 Missing Optional Fields:');
      Object.entries(report.missingFields).forEach(([table, fields]) => {
        console.log(`   • ${table}: ${fields.join(', ')}`);
      });
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:\n');
    report.recommendations.forEach((rec, index) => {
      const icon = rec.type === 'critical' ? '🚨' : rec.type === 'important' ? '⚠️' : rec.type === 'success' ? '✅' : 'ℹ️';
      console.log(`${index + 1}. ${icon} ${rec.message}`);
      console.log(`   Action: ${rec.action}\n`);
    });

    // Migration command
    if (report.missingAuthTables.length > 0 || report.tablesNeedinginstitutionId.length > 0) {
      console.log('🚀 QUICK FIX:');
      console.log('   Run: node auto-migrate-existing-project.js');
      console.log('   This will automatically fix all compatibility issues.\n');
    }
  }
}

async function checkDatabase() {
  try {
    console.log('🔍 Universal Auth - Database Compatibility Checker\n');

    const db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'your_app_db'
    });

    console.log('✅ Connected to database:', process.env.DB_NAME || 'your_app_db');

    const checker = new CompatibilityChecker(db);
    const report = await checker.checkCompatibility();

    await db.end();

    // Return compatibility status
    const isCompatible = report.missingAuthTables.length === 0 && report.tablesNeedinginstitutionId.length === 0;
    process.exit(isCompatible ? 0 : 1);

  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    console.log('\n🔧 Please check:');
    console.log('1. Database connection settings in .env');
    console.log('2. Database exists and is accessible');
    console.log('3. User has proper permissions');
    process.exit(1);
  }
}

if (require.main === module) {
  checkDatabase();
}

module.exports = CompatibilityChecker;