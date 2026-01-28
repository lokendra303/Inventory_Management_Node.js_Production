#!/usr/bin/env node

// quick-start.js - One command to get started

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🚀 Universal Auth System - Quick Start\n');

async function quickStart() {
  try {
    // 1. Check if .env exists
    if (!fs.existsSync('.env')) {
      console.log('📝 Creating .env file...');
      fs.copyFileSync('config.env', '.env');
      console.log('✅ Created .env file');
      console.log('⚠️  Please update .env with your database credentials\n');
    }

    // 2. Install dependencies if needed
    if (!fs.existsSync('node_modules')) {
      console.log('📦 Installing dependencies...');
      execSync('npm install', { stdio: 'inherit' });
      console.log('✅ Dependencies installed\n');
    }

    // 3. Check database compatibility
    console.log('🔍 Checking database compatibility...');
    try {
      execSync('node tools/check.js', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️  Database needs migration\n');
      
      // 4. Run migration
      console.log('🔄 Running auto-migration...');
      execSync('node tools/migrate.js', { stdio: 'inherit' });
    }

    // 5. Run tests
    console.log('\n🧪 Running system tests...');
    execSync('node tools/test.js', { stdio: 'inherit' });

    console.log('\n🎉 Quick start completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('1. Check examples/app.js for usage');
    console.log('2. Read package/docs/IMPLEMENTATION-GUIDE.md');
    console.log('3. Start building your app with authentication!');

  } catch (error) {
    console.error('\n❌ Quick start failed:', error.message);
    console.log('\n🔧 Manual steps:');
    console.log('1. Update .env with database credentials');
    console.log('2. Run: npm install');
    console.log('3. Run: node tools/migrate.js');
    console.log('4. Run: node tools/test.js');
  }
}

quickStart();