-- Promociones tipo combo. El servidor crea estas tablas solas al arrancar (index.js);
-- este archivo es la referencia por si hay que crearlas a mano.

-- tipo 'precio_combo': el combo completo cuesta `valor`. tipo 'descuento': se restan `valor` pesos al combo.
CREATE TABLE IF NOT EXISTS promocion (
  promocion_id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  tipo ENUM('precio_combo', 'descuento') NOT NULL,
  valor DECIMAL(12, 4) NOT NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Productos (y cantidad de cada uno) que forman el combo
CREATE TABLE IF NOT EXISTS promocion_producto (
  promocion_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad DECIMAL(10, 3) NOT NULL,
  PRIMARY KEY (promocion_id, producto_id),
  FOREIGN KEY (promocion_id) REFERENCES promocion(promocion_id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES producto(producto_id) ON DELETE CASCADE
);

-- Promociones aplicadas en cada venta (para reimprimir el ticket). Los subtotales de detalle_ventas
-- ya llevan el descuento repartido, así que los reportes de ingresos y utilidad no cambian.
CREATE TABLE IF NOT EXISTS venta_promocion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT NOT NULL,
  promocion_id INT NULL,
  nombre VARCHAR(80) NOT NULL,
  veces INT NOT NULL,
  descuento DECIMAL(10, 2) NOT NULL,
  INDEX idx_venta_promocion_venta (venta_id)
);
