const mysql = require('mysql2/promise');

async function verifyTables() {
  const conn = await mysql.createConnection({
    host: 'localhost', 
    port: 3306, 
    user: 'root', 
    password: '12345', 
    database: 'ims_sepcune'
  });
  
  try {
    const [tables] = await conn.execute("SHOW TABLES LIKE 'institution%'");
    console.log('Institution tables:');
    tables.forEach(t => console.log('  -', Object.values(t)[0]));
    
    const [inst] = await conn.execute('SELECT COUNT(*) as count FROM institutions');
    const [users] = await conn.execute('SELECT COUNT(*) as count FROM institution_users');
    
    console.log('\nData counts:');
    console.log('  Institutions:', inst[0].count);
    console.log('  Institution Users:', users[0].count);
    
    console.log('\n✅ Tables successfully created and populated!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await conn.end();
  }
}

verifyTables();