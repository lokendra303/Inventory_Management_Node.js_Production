const { spawn } = require('child_process');

console.log('🚀 Starting server and monitoring for errors...\n');

const server = spawn('node', ['src/server.js'], {
  stdio: 'pipe',
  cwd: process.cwd()
});

let hasStarted = false;
let errors = [];

server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('STDOUT:', output);
  
  if (output.includes('Server started') || output.includes('listening')) {
    hasStarted = true;
    console.log('✅ Server started successfully!');
    
    // Wait a bit more to catch any route loading errors
    setTimeout(() => {
      if (errors.length === 0) {
        console.log('✅ No runtime errors detected!');
      } else {
        console.log('❌ Errors found:');
        errors.forEach(err => console.log(`   ${err}`));
      }
      server.kill();
      process.exit(0);
    }, 3000);
  }
});

server.stderr.on('data', (data) => {
  const error = data.toString();
  console.log('STDERR:', error);
  errors.push(error.trim());
  
  // If it's a critical error, kill immediately
  if (error.includes('Error:') || error.includes('TypeError:')) {
    console.log('❌ Critical error detected!');
    server.kill();
    process.exit(1);
  }
});

server.on('close', (code) => {
  if (!hasStarted) {
    console.log(`❌ Server failed to start (exit code: ${code})`);
    if (errors.length > 0) {
      console.log('Errors:');
      errors.forEach(err => console.log(`   ${err}`));
    }
  }
});

// Timeout after 10 seconds
setTimeout(() => {
  if (!hasStarted) {
    console.log('⏰ Timeout - server taking too long to start');
    server.kill();
    process.exit(1);
  }
}, 10000);