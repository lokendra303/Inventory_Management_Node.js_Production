console.log('Testing server startup...');
try {
  require('./src/server.js');
  setTimeout(() => {
    console.log('✅ Server started successfully!');
    process.exit(0);
  }, 2000);
} catch (error) {
  console.error('❌ Server startup failed:', error.message);
  process.exit(1);
}