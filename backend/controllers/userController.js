const db = require('../db');
const bcrypt = require('bcrypt');
const logActivity = require('../utils/logActivity');

exports.createUser = async (req, res) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ error: "Solo los administradores pueden crear usuarios" });
    }
    const { username, password, rol, sucursal_id } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Usuario y contraseña son requeridos" });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
    }
    if (!['admin', 'vendedor', 'operador'].includes(rol)) {
        return res.status(400).json({ error: "Rol inválido" });
    }
    try {
        const sucursalFinal = sucursal_id || req.user.sucursal_id;
        const [[suc]] = await db.query('SELECT sucursal_id FROM sucursal WHERE sucursal_id = ?', [sucursalFinal]);
        if (!suc) return res.status(400).json({ error: "Sucursal inválida" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO usuario (username, password, rol, sucursal_id) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, rol || 'operador', sucursalFinal]
        );
        await logActivity(req, 'USUARIO_CREADO', `"${username}" · Rol: ${rol}`);
        res.json({ message: 'Usuario creado', id: result.insertId });
    } catch (error) {
        console.error("Error en createUser:", error.message);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: "Ese nombre de usuario ya existe" });
        }
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
    let target;
    try {
        [[target]] = await db.query('SELECT username FROM usuario WHERE usuario_id = ?', [id]);
        if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
        await db.query('DELETE FROM usuario WHERE usuario_id = ?', [id]);
        await logActivity(req, 'USUARIO_ELIMINADO', `"${target.username}"`);
        res.json({ message: 'Usuario eliminado' });
    } catch (error) {
        // Con ventas o movimientos ligados no se puede borrar sin perder historial: se desactiva.
        if (error.errno === 1451) {
            try {
                await db.query('UPDATE usuario SET activo = 0 WHERE usuario_id = ?', [id]);
                await logActivity(req, 'USUARIO_DESACTIVADO', `"${target?.username || id}"`);
                return res.json({
                    message: 'El usuario tiene ventas o movimientos registrados, por eso se desactivó en lugar de eliminarse. Ya no puede iniciar sesión.',
                    desactivado: true,
                });
            } catch (e2) {
                console.error("Error desactivando usuario:", e2.message);
            }
        }
        console.error("Error en deleteUser:", error.message);
        res.status(500).json({ error: "No se pudo eliminar el usuario" });
    }
};

exports.reactivateUser = async (req, res) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ error: "Solo los administradores pueden reactivar usuarios" });
    }
    const { id } = req.params;
    try {
        const [result] = await db.query('UPDATE usuario SET activo = 1 WHERE usuario_id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Usuario no encontrado" });
        await logActivity(req, 'USUARIO_REACTIVADO', `ID ${id}`);
        res.json({ message: 'Usuario reactivado' });
    } catch (error) {
        console.error("Error en reactivateUser:", error.message);
        res.status(500).json({ error: "Error al reactivar el usuario" });
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
