CREATE TABLE IF NOT EXISTS movimientos_inventario (
    movimiento_id   INT AUTO_INCREMENT PRIMARY KEY,
    tipo            ENUM('entrada', 'transferencia') NOT NULL,
    producto_id     INT NOT NULL,
    usuario_id      INT,
    sucursal_origen_id  INT,
    sucursal_destino_id INT,
    cantidad        DECIMAL(10,2) NOT NULL,
    fecha           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES producto(producto_id),
    FOREIGN KEY (usuario_id)  REFERENCES usuario(usuario_id)
);
