CREATE TABLE IF NOT EXISTS actividad_usuario (
    actividad_id   INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id     INT,
    username       VARCHAR(100),
    accion         VARCHAR(60) NOT NULL,
    descripcion    TEXT,
    ip             VARCHAR(45),
    fecha          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuario(usuario_id) ON DELETE SET NULL
);
