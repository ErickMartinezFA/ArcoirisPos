const db = require('../db');
const logActivity = require('../utils/logActivity');

const soloAdmin = (req, res) => {
    if (req.user.rol !== 'admin') {
        res.status(403).json({ error: "Solo los administradores pueden realizar esta acción" });
        return false;
    }
    return true;
};

const precioValido = (v) => typeof v === 'number' && isFinite(v) && v >= 0;

exports.createProduct = async (req, res) => {
    if (!soloAdmin(req, res)) return;
    const { codigo_barras, nombre, precio_venta, precio_compra, unidad, descripcion, sucursal_id, stock_inicial } = req.body;
    const pv = Number(precio_venta);
    const pc = Number(precio_compra);
    const si = Number(stock_inicial);
    if (!nombre || !unidad) return res.status(400).json({ error: "Nombre y unidad son requeridos" });
    if (!precioValido(pv) || !precioValido(pc)) return res.status(400).json({ error: "Precios inválidos" });
    if (isNaN(si) || si < 0) return res.status(400).json({ error: "Stock inicial inválido" });

    try {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            const [productResult] = await conn.query(
                "INSERT INTO producto (codigo_barras, nombre, precio_venta, precio_compra, unidad, descripcion) VALUES (?, ?, ?, ?, ?, ?)",
                [codigo_barras, nombre, pv, pc, unidad, descripcion]
            );
            const newProductId = productResult.insertId;
            const [sucursales] = await conn.query("SELECT sucursal_id FROM sucursal");
            for (const s of sucursales) {
                const stock = (s.sucursal_id == sucursal_id) ? si : 0;
                await conn.query(
                    "INSERT INTO inventario (producto_id, sucursal_id, stock_actual) VALUES (?, ?, ?)",
                    [newProductId, s.sucursal_id, stock]
                );
            }
            await conn.commit();
            await logActivity(req, 'PRODUCTO_CREADO', `"${nombre}" · PV $${pv} · PC $${pc}`);
            res.status(201).json({ message: "Producto registrado con éxito" });
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error("Error en createProduct:", error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.getProducts = async (req, res) => {
    const sucursal_id = req.query.sucursal_id || req.user.sucursal_id;
    const termino = req.query.search || '';
    try {
        const [rows] = await db.query(`
            SELECT p.*, COALESCE(i.stock_actual, 0) AS stock_actual
            FROM producto p
            LEFT JOIN inventario i ON p.producto_id = i.producto_id AND i.sucursal_id = ?
            WHERE (p.nombre LIKE ? OR p.codigo_barras LIKE ?)
        `, [sucursal_id, `%${termino}%`, `%${termino}%`]);
        res.json(rows);
    } catch (error) {
        console.error("Error en getProducts:", error.message);
        res.status(500).json({ error: "Error al obtener productos" });
    }
};

exports.updateProduct = async (req, res) => {
    if (!soloAdmin(req, res)) return;
    const { id } = req.params;
    const { codigo_barras, nombre, precio_venta, precio_compra, unidad, descripcion } = req.body;
    const pv = Number(precio_venta);
    const pc = Number(precio_compra);
    if (!precioValido(pv) || !precioValido(pc)) return res.status(400).json({ error: "Precios inválidos" });
    try {
        const [result] = await db.query(
            "UPDATE producto SET codigo_barras = ?, nombre = ?, precio_venta = ?, precio_compra = ?, unidad = ?, descripcion = ? WHERE producto_id = ?",
            [codigo_barras, nombre, pv, pc, unidad, descripcion, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: "Producto no encontrado" });
        await logActivity(req, 'PRODUCTO_EDITADO', `ID ${id} · "${nombre}" · PV $${pv} · PC $${pc}`);
        res.json({ message: "Producto actualizado" });
    } catch (error) {
        console.error("Error en updateProduct:", error.message);
        res.status(500).json({ error: "Error al actualizar el producto" });
    }
};

exports.getSucursales = async (req, res) => {
    try {
        const [rows] = await db.query("SELECT sucursal_id, Nombre FROM sucursal");
        res.json(rows);
    } catch (error) {
        console.error("Error en getSucursales:", error.message);
        res.status(500).json({ error: "No se pudieron cargar las sucursales" });
    }
};
