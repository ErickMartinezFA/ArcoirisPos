const db = require('../db');
const logActivity = require('../utils/logActivity');

const soloAdmin = (req, res) => {
    if (req.user.rol !== 'admin') {
        res.status(403).json({ error: "Solo los administradores pueden realizar esta acción" });
        return false;
    }
    return true;
};

exports.addStock = async (req, res) => {
    if (!soloAdmin(req, res)) return;
    const { producto_id, sucursal_id, cantidad } = req.body;
    const usuario_id = req.user?.usuario_id || null;
    if (!producto_id || !sucursal_id || !(Number(cantidad) > 0)) {
        return res.status(400).json({ error: "Datos inválidos: cantidad debe ser mayor a 0" });
    }
    try {
        const [result] = await db.query(
            "UPDATE inventario SET stock_actual = stock_actual + ? WHERE producto_id = ? AND sucursal_id = ?",
            [cantidad, producto_id, sucursal_id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "No existe ese producto en la sucursal indicada" });
        }
        await db.query(
            "INSERT INTO movimientos_inventario (tipo, producto_id, usuario_id, sucursal_origen_id, cantidad) VALUES ('entrada', ?, ?, ?, ?)",
            [producto_id, usuario_id, sucursal_id, cantidad]
        );
        await logActivity(req, 'ENTRADA_STOCK', `Producto ID ${producto_id} · +${cantidad} unidades · Sucursal ${sucursal_id}`);
        res.json({ message: "Stock actualizado" });
    } catch (error) {
        console.error("Error en addStock:", error.message);
        res.status(500).json({ error: "Error al actualizar stock" });
    }
};

exports.transferStock = async (req, res) => {
    if (!soloAdmin(req, res)) return;
    const { producto_id, sucursal_origen_id, sucursal_destino_id, cantidad } = req.body;
    const usuario_id = req.user?.usuario_id || null;

    if (!producto_id || !sucursal_origen_id || !sucursal_destino_id || !(Number(cantidad) > 0)) {
        return res.status(400).json({ error: "Faltan datos para la transferencia o cantidad inválida" });
    }
    if (Number(sucursal_origen_id) === Number(sucursal_destino_id)) {
        return res.status(400).json({ error: "El origen y destino no pueden ser la misma sucursal" });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [stockRows] = await conn.query(
            "SELECT stock_actual FROM inventario WHERE producto_id = ? AND sucursal_id = ?",
            [producto_id, sucursal_origen_id]
        );

        const stockDisponible = stockRows[0]?.stock_actual ?? 0;
        if (stockDisponible < cantidad) {
            await conn.rollback();
            return res.status(400).json({
                error: `Stock insuficiente en la sucursal origen (disponible: ${stockDisponible})`
            });
        }

        await conn.query(
            "UPDATE inventario SET stock_actual = stock_actual - ? WHERE producto_id = ? AND sucursal_id = ?",
            [cantidad, producto_id, sucursal_origen_id]
        );

        const [existe] = await conn.query(
            "SELECT inventario_id FROM inventario WHERE producto_id = ? AND sucursal_id = ?",
            [producto_id, sucursal_destino_id]
        );
        if (existe.length > 0) {
            await conn.query(
                "UPDATE inventario SET stock_actual = stock_actual + ? WHERE producto_id = ? AND sucursal_id = ?",
                [cantidad, producto_id, sucursal_destino_id]
            );
        } else {
            await conn.query(
                "INSERT INTO inventario (producto_id, sucursal_id, stock_actual) VALUES (?, ?, ?)",
                [producto_id, sucursal_destino_id, cantidad]
            );
        }

        await conn.query(
            "INSERT INTO movimientos_inventario (tipo, producto_id, usuario_id, sucursal_origen_id, sucursal_destino_id, cantidad) VALUES ('transferencia', ?, ?, ?, ?, ?)",
            [producto_id, usuario_id, sucursal_origen_id, sucursal_destino_id, cantidad]
        );

        await conn.commit();
        await logActivity(req, 'TRANSFERENCIA', `Producto ID ${producto_id} · ${cantidad} unidades · Sucursal ${sucursal_origen_id} → ${sucursal_destino_id}`);
        res.json({ message: "Transferencia realizada con éxito" });
    } catch (error) {
        await conn.rollback();
        console.error("Error en transferStock:", error.message);
        res.status(500).json({ error: "Error al procesar la transferencia" });
    } finally {
        conn.release();
    }
};

exports.getInventoryReport = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                p.producto_id,
                p.codigo_barras,
                p.nombre AS producto,
                p.unidad,
                i.sucursal_id,
                COALESCE(s.Nombre, 'SIN SUCURSAL') AS sucursal,
                COALESCE(i.stock_actual, 0) AS stock_actual
            FROM producto p
            LEFT JOIN inventario i ON p.producto_id = i.producto_id
            LEFT JOIN sucursal s ON i.sucursal_id = s.sucursal_id
            ORDER BY p.nombre ASC
        `);
        res.json(rows);
    } catch (error) {
        console.error("Error en getInventoryReport:", error.message);
        res.status(500).json({ error: "Error al generar el reporte" });
    }
};
