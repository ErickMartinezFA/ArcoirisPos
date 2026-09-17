const mysql = require('mysql2/promise');

async function test() {
  try {
    const connection = await mysql.createConnection({
      host: 'reseau.proxy.rlwy.net',
      port: 14310,
      user: 'root',
      password: 'OPVmNQmTZDmhEbhvfYNXXgjydDRDjRUk',
      database: 'railway',
      ssl: { rejectUnauthorized: false },
      connectTimeout: 20000,
    });
    console.log('✅ Conectado exitosamente');
    const [rows] = await connection.query('SELECT 1 AS test');
    console.log('✅ Query de prueba OK:', rows);
    await connection.end();
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    console.error('Código:', error.code);
  }
}

test();
