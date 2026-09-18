const jwt = require('jsonwebtoken');
const db = require('../db');

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    // Un usuario desactivado o eliminado pierde acceso de inmediato, sin esperar a que venza su token.
    try {
        const [rows] = await db.query('SELECT activo FROM usuario WHERE usuario_id = ?', [decoded.usuario_id]);
        if (!rows[0] || rows[0].activo === 0) {
            return res.status(401).json({ error: 'Usuario desactivado o inexistente' });
        }
    } catch (e) {
        console.error('Error verificando usuario en authMiddleware:', e.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }

    req.user = decoded;
    next();
};

module.exports = authMiddleware;
