const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const pool = mysql.createPool({
  host: 'bjmabgsbpfkifdhmavvp-mysql.services.clever-cloud.com',
  port: 3306,
  user: 'uowkqssffxkwvjb9',
  password: 'UCwQRYRBv9iUOJyLhSi8',
  database: 'bjmabgsbpfkifdhmavvp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const dropAll = `
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS actividad_usuario;
DROP TABLE IF EXISTS movimientos_inventario;
DROP TABLE IF EXISTS detalle_ventas;
DROP TABLE IF EXISTS venta;
DROP TABLE IF EXISTS inventario;
DROP TABLE IF EXISTS producto;
DROP TABLE IF EXISTS usuario;
DROP TABLE IF EXISTS sucursal;
SET FOREIGN_KEY_CHECKS = 1;
`;

const tables = `
CREATE TABLE sucursal (
  sucursal_id INT AUTO_INCREMENT PRIMARY KEY,
  Nombre VARCHAR(255) NOT NULL,
  ubicacion VARCHAR(255),
  activo TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuario (
  usuario_id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255),
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  rol ENUM('admin', 'vendedor', 'operador') DEFAULT 'vendedor',
  sucursal_id INT NOT NULL,
  activo TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(sucursal_id)
);

CREATE TABLE producto (
  producto_id INT AUTO_INCREMENT PRIMARY KEY,
  codigo_barras VARCHAR(100) UNIQUE,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  precio_venta DECIMAL(10, 2) NOT NULL,
  precio_compra DECIMAL(10, 2) NOT NULL,
  unidad VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventario (
  inventario_id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  sucursal_id INT NOT NULL,
  stock_actual DECIMAL(10, 2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_producto_sucursal (producto_id, sucursal_id),
  FOREIGN KEY (producto_id) REFERENCES producto(producto_id),
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(sucursal_id)
);

CREATE TABLE venta (
  venta_id INT AUTO_INCREMENT PRIMARY KEY,
  total DECIMAL(10, 2),
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id INT NOT NULL,
  sucursal_id INT NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuario(usuario_id),
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(sucursal_id)
);

CREATE TABLE detalle_ventas (
  detalle_id INT AUTO_INCREMENT PRIMARY KEY,
  id_venta INT NOT NULL,
  id_producto INT NOT NULL,
  cantidad DECIMAL(10, 2) NOT NULL,
  precio_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (id_venta) REFERENCES venta(venta_id),
  FOREIGN KEY (id_producto) REFERENCES producto(producto_id)
);

CREATE TABLE movimientos_inventario (
  movimiento_id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('entrada', 'transferencia') NOT NULL,
  producto_id INT NOT NULL,
  usuario_id INT,
  sucursal_origen_id INT,
  sucursal_destino_id INT,
  cantidad DECIMAL(10, 2) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES producto(producto_id),
  FOREIGN KEY (usuario_id) REFERENCES usuario(usuario_id),
  FOREIGN KEY (sucursal_origen_id) REFERENCES sucursal(sucursal_id),
  FOREIGN KEY (sucursal_destino_id) REFERENCES sucursal(sucursal_id)
);

CREATE TABLE actividad_usuario (
  actividad_id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT,
  username VARCHAR(100),
  accion VARCHAR(60) NOT NULL,
  descripcion TEXT,
  ip VARCHAR(45),
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuario(usuario_id) ON DELETE SET NULL
);
`;

async function setupDatabase() {
  const connection = await pool.getConnection();

  try {
    console.log('🗑️  Eliminando tablas viejas (si existen)...');
    const dropStatements = dropAll.split(';').map(s => s.trim()).filter(Boolean);
    for (const statement of dropStatements) {
      await connection.query(statement);
    }
    console.log('✅ Tablas viejas eliminadas');

    console.log('🔧 Creando tablas con el schema correcto...');
    const tableStatements = tables.split(';').map(s => s.trim()).filter(Boolean);
    for (const statement of tableStatements) {
      await connection.query(statement);
    }
    console.log('✅ Tablas creadas exitosamente');

    console.log('🏪 Creando sucursal principal...');
    await connection.query(
      'INSERT INTO sucursal (Nombre, ubicacion) VALUES (?, ?)',
      ['Sucursal Principal', 'Puebla, Puebla']
    );
    console.log('✅ Sucursal creada');

    console.log('👤 Creando usuario admin...');
    const tempPassword = 'ArcoirisPos2026!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await connection.query(
      'INSERT INTO usuario (nombre, username, password, rol, sucursal_id) VALUES (?, ?, ?, ?, ?)',
      ['Erick Martínez', 'erick_martinez', hashedPassword, 'admin', 1]
    );
    console.log('✅ Usuario admin creado');

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✨ BASE DE DATOS CONFIGURADA EXITOSAMENTE (schema correcto)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n📋 CREDENCIALES DEL SISTEMA:\n');
    console.log('👤 Usuario: erick_martinez');
    console.log('🔐 Contraseña temporal: ' + tempPassword);
    console.log('⚠️  Cambiar en primer login');
    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

setupDatabase();
