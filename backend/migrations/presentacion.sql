CREATE TABLE IF NOT EXISTS presentacion (
  presentacion_id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  nombre VARCHAR(50) NOT NULL,
  cantidad DECIMAL(10, 3) NOT NULL,
  precio_venta DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES producto(producto_id) ON DELETE CASCADE
);
