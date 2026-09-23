const db = require('../db');
const logActivity = require('../utils/logActivity');
const { redondear2 } = require('../utils/precio');

const soloAdmin = (req, res) => {
    if (req.user.rol !== 'admin') {
        res.status(403).json({ error: "Solo los administradores pueden procesar devoluciones" });
        return false;
    }
    return true;
};

// Busca una venta por folio y devuelve sus renglones con lo ya devuelto y lo disponible a devolver.
exports.getVentaParaDevolucion = async (req, res) => {
    if (!soloAdmin(req, res)) return;
    const { venta_id } = req.params;
    try {
        const [[venta]] = await db.query(`
            SELECT v.venta_id, v.fecha, v.total, v.sucursal_id, v.metodo_pago,
                   IFNULL(u.username, 'Desconocido') AS vendedor,
                   IFNULL(s.Nombre, 'Global') AS sucursal
            FROM venta v
            LEFT JOIN usuario u ON v.usuario_id = u.usuario_id
            LEFT JOIN sucursal s ON v.sucursal_id = s.sucursal_id
            WHERE v.venta_id = ?
        `, [venta_id]);
        if (!venta) return res.status(404).json({ error: "Venta no encontrada" });

        const [items] = await db.query(`
            SELECT
                dv.detalle_id, dv.id_producto AS producto_id, dv.cantidad, dv.precio_unitario, dv.subtotal,
                p.nombre, p.unidad,
                COALESCE((SELECT SUM(dd.cantidad) FROM devolucion_detalle dd WHERE dd.detalle_id = dv.detalle_id), 0) AS ya_devuelto
            FROM detalle_ventas dv
            JOIN producto p ON p.producto_id = dv.id_producto
            WHERE dv.id_venta = ?
        `, [venta_id]);

        res.json({
            ...venta,
            items: items.map(i => ({
                ...i,
                cantidad: Number(i.cantidad),
                ya_devuelto: Number(i.ya_devuelto),
                disponible: redondear2(Number(i.cantidad) - Number(i.ya_devuelto)),
            })),
        });
    } catch (error) {
        console.error("Error en getVentaParaDevolucion:", error.message);
        res.status(500).json({ error: "Error al buscar la venta" });
    }
};

exports.crear = async (req, res) => {
    if (!soloAdmin(req, res)) return;
    const { venta_id, motivo, items } = req.body;
    const motivoLimpio = typeof motivo === 'string' ? motivo.trim() : '';

    if (!motivoLimpio) return res.status(400).json({ error: "Escribe el motivo de la devolución" });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Elige al menos un producto a devolver" });

    const conn = await db.getConnection();
    try {
        const [[venta]] = await conn.query("SELECT venta_id, sucursal_id FROM venta WHERE venta_id = ?", [venta_id]);
        if (!venta) { conn.release(); return res.status(404).json({ error: "Venta no encontrada" }); }

        await conn.beginTransaction();

        const lineas = [];
        for (const item of items) {
            const detalle_id = Number(item.detalle_id);
            const cant = Number(item.cantidad);
            if (!(cant > 0) || Math.round(cant * 100) / 100 !== cant) {
                await conn.rollback();
                return res.status(400).json({ error: "Cantidad inválida (máximo 2 decimales)" });
            }

            // FOR UPDATE serializa devoluciones concurrentes del mismo renglón: la siguiente
            // solicitud espera a que esta termine antes de recalcular lo ya devuelto.
            const [[detalle]] = await conn.query(
                "SELECT detalle_id, id_producto, cantidad, precio_unitario FROM detalle_ventas WHERE detalle_id = ? AND id_venta = ? FOR UPDATE",
                [detalle_id, venta_id]
            );
            if (!detalle) {
                await conn.rollback();
                return res.status(400).json({ error: `El renglón ${detalle_id} no pertenece a esta venta` });
            }

            const [[{ ya_devuelto }]] = await conn.query(
                "SELECT COALESCE(SUM(cantidad), 0) AS ya_devuelto FROM devolucion_detalle WHERE detalle_id = ?",
                [detalle_id]
            );
            const disponible = redondear2(Number(detalle.cantidad) - Number(ya_devuelto));
            if (cant > disponible) {
                await conn.rollback();
                return res.status(400).json({ error: `Solo hay ${disponible} disponibles para devolver de ese producto` });
            }

            lineas.push({
                detalle_id,
                producto_id: detalle.id_producto,
                cantidad: cant,
                monto: redondear2(cant * Number(detalle.precio_unitario)),
            });
        }

        const total = redondear2(lineas.reduce((s, l) => s + l.monto, 0));
        const [result] = await conn.query(
            "INSERT INTO devolucion (venta_id, usuario_id, motivo, total) VALUES (?, ?, ?, ?)",
            [venta_id, req.user.usuario_id, motivoLimpio, total]
        );
        const devolucion_id = result.insertId;

        for (const l of lineas) {
            await conn.query(
                "INSERT INTO devolucion_detalle (devolucion_id, detalle_id, producto_id, cantidad, monto) VALUES (?, ?, ?, ?, ?)",
                [devolucion_id, l.detalle_id, l.producto_id, l.cantidad, l.monto]
            );
            await conn.query(
                `INSERT INTO inventario (producto_id, sucursal_id, stock_actual) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE stock_actual = stock_actual + ?`,
                [l.producto_id, venta.sucursal_id, l.cantidad, l.cantidad]
            );
            await conn.query(
                "INSERT INTO movimientos_inventario (tipo, producto_id, usuario_id, sucursal_origen_id, cantidad) VALUES ('devolucion', ?, ?, ?, ?)",
                [l.producto_id, req.user.usuario_id, venta.sucursal_id, l.cantidad]
            );
        }

        await conn.commit();
        await logActivity(req, 'DEVOLUCION', `Venta #${venta_id} · Total $${total} · Motivo: ${motivoLimpio}`);
        res.status(201).json({ message: "Devolución registrada", devolucion_id, total });
    } catch (error) {
        await conn.rollback().catch(() => {});
        console.error("Error en crear devolucion:", error.message);
        res.status(500).json({ error: "Error al procesar la devolución" });
    } finally {
        conn.release();
    }
};
