const mysql = require('mysql2/promise');

async function activateUser() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    const [result] = await connection.execute(
      "UPDATE users SET status = 'active' WHERE email = 'lk.kushwah303@gmail.com'"
    );
    
    console.log('User activated:', result.affectedRows, 'rows affected');
    
    // Check current status
    const [users] = await connection.execute(
      "SELECT email, status FROM users WHERE email = 'lk.kushwah303@gmail.com'"
    );
    
    console.log('Current user status:', users[0]);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

activateUser();