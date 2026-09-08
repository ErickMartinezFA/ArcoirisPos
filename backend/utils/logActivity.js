const db = require('../db');

const logActivity = async (req, accion, descripcion) => {
    try {
        const usuario_id = req.user?.usuario_id || null;
        const username   = req.user?.username || null;
        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
                || req.socket?.remoteAddress
                || null;
        await db.query(
            "INSERT INTO actividad_usuario (usuario_id, username, accion, descripcion, ip) VALUES (?, ?, ?, ?, ?)",
            [usuario_id, username, accion, descripcion, ip]
        );
    } catch {
        // El log nunca debe romper la operación principal
    }
};

module.exports = logActivity;
