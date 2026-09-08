const db = require('../db');
const bcrypt = require('bcrypt');
const logActivity = require('../utils/logActivity');

exports.createUser = async (req, res) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ error: "Solo los administradores pueden crear usuarios" });
    }
    const { username, password, rol } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Usuario y contraseña son requeridos" });
    }
    if (!['admin', 'vendedor', 'operador'].includes(rol)) {
        return res.status(400).json({ error: "Rol inválido" });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO usuario (username, password, rol) VALUES (?, ?, ?)',
            [username, hashedPassword, rol || 'operador']
        );
        await logActivity(req, 'USUARIO_CREADO', `"${username}" · Rol: ${rol}`);
        res.json({ message: 'Usuario creado', id: result.insertId });
    } catch (error) {
        console.error("Error en createUser:", error.message);
        res.status(500).json({ error: "Error al crear el usuario" });
    }
};

exports.deleteUser = async (req, res) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ error: "Solo los administradores pueden eliminar usuarios" });
    }
    const { id } = req.params;
    if (parseInt(id) === req.user.usuario_id) {
        return res.status(400).json({ error: "No puedes eliminar tu propio usuario en sesión" });
    }
    try {
        const [[target]] = await db.query('SELECT username FROM usuario WHERE usuario_id = ?', [id]);
        await db.query('DELETE FROM usuario WHERE usuario_id = ?', [id]);
        await logActivity(req, 'USUARIO_ELIMINADO', `"${target?.username || id}"`);
        res.json({ message: 'Usuario eliminado' });
    } catch (error) {
        console.error("Error en deleteUser:", error.message);
        res.status(500).json({ error: "No se pudo eliminar (puede tener ventas ligadas)" });
    }
};

exports.resetPassword = async (req, res) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ error: "Solo los administradores pueden cambiar contraseñas" });
    }
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
    }
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE usuario SET password = ? WHERE usuario_id = ?', [hashedPassword, id]);
        res.json({ message: 'Contraseña actualizada' });
    } catch (error) {
        console.error("Error en resetPassword:", error.message);
        res.status(500).json({ error: "Error al actualizar la contraseña" });
    }
};
