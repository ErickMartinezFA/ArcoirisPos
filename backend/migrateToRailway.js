const mysql = require('mysql2/promise');
require('dotenv').config();

// Origen: Clever Cloud (usa las variables de entorno ya configuradas en Render)
const source = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Destino: Railway
const target = mysql.createPool({
  host: 'reseau.proxy.rlwy.net',
  port: 14310,
  user: 'root',
  password: 'OPVmNQmTZDmhEbhvfYNXXgjydDRDjRUk',
  database: 'railway',
  ssl: { rejectUnauthorized: false },
  connectTimeout: 30000,
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

// Orden respeta FKs: padres antes que hijos
const copyOrder = [
  'sucursal',
  'usuario',
  'producto',
  'inventario',
  'venta',
  'detalle_ventas',
  'movimientos_inventario',
  'actividad_usuario',
];

async function runMigration() {
  const log = [];
  const src = await source.getConnection();
  const tgt = await target.getConnection();

  try {
    log.push('Preparando esquema limpio en Railway...');
    for (const stmt of dropAll.split(';').map(s => s.trim()).filter(Boolean)) {
      await tgt.query(stmt);
    }
    for (const stmt of tables.split(';').map(s => s.trim()).filter(Boolean)) {
      await tgt.query(stmt);
    }
    log.push('Esquema creado en Railway');

    await tgt.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of copyOrder) {
      const [rows] = await src.query(`SELECT * FROM ${table}`);
      if (rows.length === 0) {
        log.push(`${table}: 0 filas, se omite`);
        continue;
      }
      const columns = Object.keys(rows[0]);
      const placeholders = `(${columns.map(() => '?').join(',')})`;
      const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${rows.map(() => placeholders).join(',')}`;
      const values = rows.flatMap(r => columns.map(c => r[c]));
      await tgt.query(sql, values);
      log.push(`${table}: ${rows.length} filas migradas`);
    }

    await tgt.query('SET FOREIGN_KEY_CHECKS = 1');
    log.push('Migración completa');
    return log;
  } finally {
    src.release();
    tgt.release();
    await source.end();
    await target.end();
  }
}

module.exports = { runMigration };
