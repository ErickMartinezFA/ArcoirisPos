const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'bscx4gzp4qx51dusegto-mysql.services.clever-cloud.com',
  port: 21719,
  user: 'uowkqssffxkwvjb9',
  password: 'UCwQRYRBv9iUOJyLhSi8',
  database: 'bscx4gzp4qx51dusegto',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function cleanForDelivery() {
  const connection = await pool.getConnection();

  try {
    console.log('🧹 Limpiando datos de prueba (se conservan usuario y sucursal)...');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    const tablesToClean = [
      'actividad_usuario',
      'movimientos_inventario',
      'detalle_ventas',
      'venta',
      'inventario',
      'producto',
    ];

    for (const table of tablesToClean) {
      await connection.query(`TRUNCATE TABLE ${table}`);
      console.log(`✅ ${table} limpiada (contador reiniciado en 0)`);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✨ BASE DE DATOS LISTA PARA ENTREGA');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('- Sin productos de prueba');
    console.log('- Sin ventas ni tickets previos (la numeración de ventas arranca en 1)');
    console.log('- Sin movimientos de inventario');
    console.log('- Sin registros de actividad previos');
    console.log('- Usuario admin y sucursales se conservan intactos');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

cleanForDelivery();
