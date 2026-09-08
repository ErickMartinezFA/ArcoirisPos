const db = require('../db');

// Devuelve el primer y último día del mes actual si no se pasan fechas
const defaultRange = () => {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
    const fin = hoy.toISOString().slice(0, 10);
    return { inicio, fin };
};

exports.getDailySales = async (req, res) => {
    if (req.user?.rol !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
    const def = defaultRange();
    const fechaInicio = req.query.fecha_inicio || def.inicio;
    const fechaFin = req.query.fecha_fin || def.fin;
    const sucursal_id = req.params.sucursal_id;
    const esAdmin = req.user.rol === 'admin';

    try {
        const whereExtra = esAdmin ? '' : 'AND v.sucursal_id = ?';
        const params = esAdmin ? [fechaInicio, fechaFin] : [fechaInicio, fechaFin, sucursal_id];
        const [rows] = await db.query(`
            SELECT
                COUNT(DISTINCT v.venta_id) AS total_operaciones,
                COALESCE(SUM(v.total), 0) AS ingresos_totales,
                COALESCE(SUM(dv.cantidad * (dv.precio_unitario - p.precio_compra)), 0) AS utilidad_neta
            FROM venta v
            LEFT JOIN detalle_ventas dv ON v.venta_id = dv.id_venta
            LEFT JOIN producto p ON dv.id_producto = p.producto_id
            WHERE DATE(v.fecha) BETWEEN ? AND ? ${whereExtra}
        `, params);
        res.json(rows[0]);
    } catch (error) {
        console.error("Error en getDailySales:", error.message);
        res.status(500).json({ error: "Error al obtener resumen de ventas" });
    }
};

exports.getTopProducts = async (req, res) => {
    if (req.user?.rol !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
    const def = defaultRange();
    const fechaInicio = req.query.fecha_inicio || def.inicio;
    const fechaFin = req.query.fecha_fin || def.fin;

    try {
        const [rows] = await db.query(`
            SELECT
                p.nombre,
                SUM(dv.cantidad) AS cantidad_vendida,
                p.unidad
            FROM detalle_ventas dv
            LEFT JOIN producto p ON dv.id_producto = p.producto_id
            LEFT JOIN venta v ON dv.id_venta = v.venta_id
            WHERE DATE(v.fecha) BETWEEN ? AND ?
            GROUP BY p.producto_id
            ORDER BY cantidad_vendida DESC
            LIMIT 5
        `, [fechaInicio, fechaFin]);
        res.json(rows);
    } catch (error) {
        console.error("Error en getTopProducts:", error.message);
        res.status(500).json({ error: "Error al obtener top productos" });
    }
};

exports.getSalesHistory = async (req, res) => {
    const def = defaultRange();
    const fechaInicio = req.query.fecha_inicio || def.inicio;
    const fechaFin = req.query.fecha_fin || def.fin;
    const esAdmin = req.user?.rol === 'admin';

    try {
        const whereExtra = esAdmin ? '' : 'AND v.usuario_id = ?';
        const params = esAdmin
            ? [fechaInicio, fechaFin]
            : [fechaInicio, fechaFin, req.user.usuario_id];

        const [rows] = await db.query(`
            SELECT
                v.venta_id,
                v.fecha,
                v.total,
                IFNULL(u.username, 'Desconocido') AS vendedor,
                IFNULL(s.Nombre, 'Global') AS sucursal,
                COALESCE(SUM(dv.cantidad * (dv.precio_unitario - p.precio_compra)), 0) AS utilidad_neta
            FROM venta v
            LEFT JOIN usuario u ON v.usuario_id = u.usuario_id
            LEFT JOIN sucursal s ON v.sucursal_id = s.sucursal_id
            LEFT JOIN detalle_ventas dv ON v.venta_id = dv.id_venta
            LEFT JOIN producto p ON dv.id_producto = p.producto_id
            WHERE DATE(v.fecha) BETWEEN ? AND ? ${whereExtra}
            GROUP BY v.venta_id
            ORDER BY v.fecha DESC
            LIMIT 200
        `, params);
        res.json(rows);
    } catch (error) {
        console.error("Error en getSalesHistory:", error.message);
        res.status(500).json({ error: "Error al obtener historial" });
    }
};

// Admins ven el reporte global; operadores solo su propio registro
exports.getUsersSales = async (req, res) => {
    try {
        const [userRows] = await db.query('SELECT rol FROM usuario WHERE usuario_id = ?', [req.user.usuario_id]);
        const rol = userRows[0]?.rol || 'operador';

        let query, params = [];
        if (rol === 'admin') {
            query = `
                SELECT
                    u.usuario_id,
                    u.username,
                    u.rol,
                    COUNT(v.venta_id) AS numero_ventas,
                    COALESCE(SUM(v.total), 0) AS total_vendido
                FROM usuario u
                LEFT JOIN venta v ON u.usuario_id = v.usuario_id
                GROUP BY u.usuario_id
                ORDER BY total_vendido DESC
            `;
        } else {
            query = `
                SELECT
                    u.usuario_id,
                    u.username,
                    u.rol,
                    COUNT(v.venta_id) AS numero_ventas,
                    COALESCE(SUM(v.total), 0) AS total_vendido
                FROM usuario u
                LEFT JOIN venta v ON u.usuario_id = v.usuario_id
                WHERE u.usuario_id = ?
                GROUP BY u.usuario_id
            `;
            params = [req.user.usuario_id];
        }

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Error en getUsersSales:", error.message);
        res.status(500).json({ error: "Error al generar reporte de usuarios" });
    }
};

exports.getSaleDetail = async (req, res) => {
    const { venta_id } = req.params;
    const esAdmin = req.user?.rol === 'admin';
    try {
        const whereOwner = esAdmin ? '' : 'AND v.usuario_id = ?';
        const ventaParams = esAdmin ? [venta_id] : [venta_id, req.user.usuario_id];
        const [[ventaRows], [items]] = await Promise.all([
            db.query(`
                SELECT
                    v.venta_id,
                    v.fecha,
                    v.total,
                    IFNULL(u.username, 'Desconocido') AS vendedor,
                    IFNULL(s.Nombre, 'Global') AS sucursal
                FROM venta v
                LEFT JOIN usuario u ON v.usuario_id = u.usuario_id
                LEFT JOIN sucursal s ON v.sucursal_id = s.sucursal_id
                WHERE v.venta_id = ? ${whereOwner}
            `, ventaParams),
            db.query(`
                SELECT
                    p.nombre,
                    p.unidad,
                    dv.cantidad,
                    dv.precio_unitario,
                    dv.subtotal,
                    COALESCE((dv.precio_unitario - p.precio_compra) * dv.cantidad, 0) AS utilidad_item
                FROM detalle_ventas dv
                JOIN producto p ON dv.id_producto = p.producto_id
                WHERE dv.id_venta = ?
            `, [venta_id]),
        ]);

        if (!ventaRows[0]) return res.status(404).json({ error: 'Venta no encontrada' });
        res.json({ ...ventaRows[0], items });
    } catch (error) {
        console.error("Error en getSaleDetail:", error.message);
        res.status(500).json({ error: "Error al obtener detalle de venta" });
    }
};

exports.getTopByUtility = async (req, res) => {
    if (req.user?.rol !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
    const def = defaultRange();
    const fechaInicio = req.query.fecha_inicio || def.inicio;
    const fechaFin = req.query.fecha_fin || def.fin;

    try {
        const [rows] = await db.query(`
            SELECT
                p.nombre,
                p.unidad,
                SUM(dv.cantidad) AS cantidad_vendida,
                COALESCE(SUM(dv.cantidad * dv.precio_unitario), 0) AS ingresos,
                COALESCE(SUM(dv.cantidad * p.precio_compra), 0) AS costo,
                COALESCE(SUM(dv.cantidad * (dv.precio_unitario - p.precio_compra)), 0) AS utilidad
            FROM detalle_ventas dv
            JOIN producto p ON dv.id_producto = p.producto_id
            JOIN venta v ON dv.id_venta = v.venta_id
            WHERE DATE(v.fecha) BETWEEN ? AND ?
            GROUP BY p.producto_id
            ORDER BY utilidad DESC
            LIMIT 5
        `, [fechaInicio, fechaFin]);
        res.json(rows);
    } catch (error) {
        console.error("Error en getTopByUtility:", error.message);
        res.status(500).json({ error: "Error al obtener top por utilidad" });
    }
};

exports.getMovimientos = async (req, res) => {
    const def = defaultRange();
    const fechaInicio = req.query.fecha_inicio || def.inicio;
    const fechaFin = req.query.fecha_fin || def.fin;

    if (req.user?.rol !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });

    try {
        const [rows] = await db.query(`
            SELECT
                m.movimiento_id,
                m.tipo,
                m.fecha,
                m.cantidad,
                p.nombre AS producto,
                p.unidad,
                IFNULL(u.username, 'Sistema') AS usuario,
                IFNULL(so.Nombre, '—') AS sucursal_origen,
                IFNULL(sd.Nombre, '—') AS sucursal_destino
            FROM movimientos_inventario m
            JOIN producto p ON m.producto_id = p.producto_id
            LEFT JOIN usuario u ON m.usuario_id = u.usuario_id
            LEFT JOIN sucursal so ON m.sucursal_origen_id = so.sucursal_id
            LEFT JOIN sucursal sd ON m.sucursal_destino_id = sd.sucursal_id
            WHERE DATE(m.fecha) BETWEEN ? AND ?
            ORDER BY m.fecha DESC
            LIMIT 200
        `, [fechaInicio, fechaFin]);
        res.json(rows);
    } catch (error) {
        console.error("Error en getMovimientos:", error.message);
        res.status(500).json({ error: "Error al obtener movimientos" });
    }
};

exports.getActividad = async (req, res) => {
    if (req.user?.rol !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const usuario_id = req.query.usuario_id || null;

    try {
        const where = usuario_id ? 'WHERE a.usuario_id = ?' : '';
        const params = usuario_id ? [usuario_id, limit] : [limit];
        const [rows] = await db.query(`
            SELECT
                a.actividad_id,
                a.fecha,
                a.accion,
                a.descripcion,
                a.ip,
                IFNULL(a.username, 'Sistema') AS usuario
            FROM actividad_usuario a
            ${where}
            ORDER BY a.fecha DESC
            LIMIT ?
        `, params);
        res.json(rows);
    } catch (error) {
        console.error("Error en getActividad:", error.message);
        res.status(500).json({ error: "Error al obtener actividad" });
    }
};

exports.getLowStock = async (req, res) => {
    const esAdmin = req.user?.rol === 'admin';
    // Siempre usar la sucursal del JWT para no-admins, ignorar el param de URL
    const sucursal_id = esAdmin ? req.params.sucursal_id : req.user.sucursal_id;
    try {
        const whereClause = esAdmin ? 'i.stock_actual <= 10' : 'i.sucursal_id = ? AND i.stock_actual <= 10';
        // params: whereClause usa sucursal_id solo si no es admin; el JOIN de otras siempre excluye la propia sucursal via otras.sucursal_id != i.sucursal_id (no necesita param)
        const params = esAdmin ? [] : [sucursal_id];

        const [rows] = await db.query(`
            SELECT
                p.producto_id,
                p.nombre,
                p.unidad,
                i.stock_actual,
                suc.Nombre AS sucursal_nombre,
                i.sucursal_id,
                JSON_ARRAYAGG(
                    JSON_OBJECT('sucursal', otras_suc.Nombre, 'stock', otras.stock_actual)
                ) AS otras_sucursales
            FROM inventario i
            JOIN producto p ON i.producto_id = p.producto_id
            JOIN sucursal suc ON i.sucursal_id = suc.sucursal_id
            LEFT JOIN inventario otras ON otras.producto_id = p.producto_id AND otras.sucursal_id != i.sucursal_id AND otras.stock_actual > 0
            LEFT JOIN sucursal otras_suc ON otras.sucursal_id = otras_suc.sucursal_id
            WHERE ${whereClause}
            GROUP BY p.producto_id, i.stock_actual, i.sucursal_id, suc.Nombre
            ORDER BY i.stock_actual ASC
            LIMIT 20
        `, params);

        const result = rows.map(r => ({
            ...r,
            otras_sucursales: (r.otras_sucursales || []).filter(s => s.sucursal !== null),
        }));
        res.json(result);
    } catch (error) {
        console.error("Error en getLowStock:", error.message);
        res.status(500).json({ error: "Error al obtener inventario crítico" });
    }
};
