const db = require('../db');
const logActivity = require('../utils/logActivity');
const { precioValido } = require('../utils/precio');

const soloAdmin = (req, res) => {
    if (req.user.rol !== 'admin') {
        res.status(403).json({ error: "Solo los administradores pueden realizar esta acción" });
        return false;
    }
    return true;
};

exports.getByProducto = async (req, res) => {
    const { producto_id } = req.params;
    try {
        const [rows] = await db.query(
            'SELECT presentacion_id, producto_id, nombre, cantidad, precio_venta FROM presentacion WHERE producto_id = ? ORDER BY cantidad ASC',
            [producto_id]
        );
        res.json(rows);
    } catch (error) {
        console.error("Error en getByProducto:", error.message);
        res.status(500).json({ error: "Error al obtener presentaciones" });
    }
};

exports.create = async (req, res) => {
    if (!soloAdmin(req, res)) return;
    const { producto_id, nombre, cantidad, precio_venta } = req.body;
    const cant = Number(cantidad);
    const precio = Number(precio_venta);
    if (!producto_id || !nombre || !(cant > 0)) {
        return res.status(400).json({ error: "Datos inválidos para la presentación" });
    }
    if (!precioValido(precio)) {
        return res.status(400).json({ error: "Precio inválido (máximo 4 decimales)" });
    }
    // El inventario guarda 2 decimales; una presentación con más restaría cantidades redondeadas
    if (Math.round(cant * 100) / 100 !== cant) {
        return res.status(400).json({ error: "La cantidad admite máximo 2 decimales" });
    }
    try {
        const [[prod]] = await db.query('SELECT producto_id FROM producto WHERE producto_id = ?', [producto_id]);
        if (!prod) return res.status(404).json({ error: "El producto no existe" });
        const [result] = await db.query(
            'INSERT INTO presentacion (producto_id, nombre, cantidad, precio_venta) VALUES (?, ?, ?, ?)',
            [producto_id, nombre, cant, precio]
        );
        await logActivity(req, 'PRESENTACION_CREADA', `Producto ID ${producto_id} · "${nombre}" · ${cant} · $${precio}`);
        res.status(201).json({ message: "Presentación creada", id: result.insertId });
    } catch (error) {
        console.error("Error en create presentacion:", error.message);
        res.status(500).json({ error: "Error al crear la presentación" });
    }
};

exports.remove = async (req, res) => {
    if (!soloAdmin(req, res)) return;
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM presentacion WHERE presentacion_id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Presentación no encontrada" });
        await logActivity(req, 'PRESENTACION_ELIMINADA', `ID ${id}`);
        res.json({ message: "Presentación eliminada" });
    } catch (error) {
        console.error("Error en remove presentacion:", error.message);
        res.status(500).json({ error: "Error al eliminar la presentación" });
    }
};
