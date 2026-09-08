const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (e) {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

module.exports = authMiddleware;
