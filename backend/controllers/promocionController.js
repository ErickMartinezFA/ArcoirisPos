const db = require('../db');
const logActivity = require('../utils/logActivity');
const { precioValido, redondear2 } = require('../utils/precio');
const { cargarActivas, aplicarPromociones, ahorroPorVez } = require('../utils/promociones');

const soloAdmin = (req, res) => {
    if (req.user.rol !== 'admin') {
        res.status(403).json({ error: "Solo los administradores pueden realizar esta acción" });
        return false;
    }
    return true;
};

const TIPOS = ['precio_combo', 'descuento'];

// Lista todas las promociones (activas o no) con sus productos y el precio normal actual del combo.
exports.listar = async (req, res) => {
    if (!soloAdmin(req, res)) return;
    try {
        const [promos] = await db.query(
            "SELECT promocion_id, nombre, tipo, valor, activa FROM promocion ORDER BY activa DESC, promocion_id DESC"
        );
        const [items] = promos.length === 0 ? [[]] : await db.query(
            `SELECT pp.promocion_id, pp.producto_id, pp.cantidad, p.nombre, p.unidad, p.precio_venta
             FROM promocion_producto pp JOIN producto p ON p.producto_id = pp.producto_id
             WHERE pp.promocion_id IN (?)`,
            [promos.map(p => p.promocion_id)]
        );
        res.json(promos.map(p => {
            const its = items.filter(i => i.promocion_id === p.promocion_id).map(i => ({
                producto_id: i.producto_id,
                nombre: i.nombre,
                unidad: i.unidad,
                cantidad: Number(i.cantidad),
                precio_venta: Number(i.precio_venta),
            }));
            const precios = new Map(its.map(i => [i.producto_id, i.precio_venta]));
            const promo = { ...p, valor: Number(p.valor), activa: !!p.activa, items: its.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })) };
            return {
                ...p,
                valor: Number(p.valor),
                activa: !!p.activa,
                items: its,
                precio_normal: redondear2(its.reduce((s, i) => s + i.cantidad * i.precio_venta, 0)),
                ahorro: redondear2(ahorroPorVez(promo, precios)),
            };
        }));
    } catch (error) {
        console.error("Error en listar promociones:", error.message);
        res.status(500).json({ error: "Error al obtener promociones" });
    }
};

exports.crear = async (req, res) => {
    if (!soloAdmin(req, res)) return;
    const { nombre, tipo, valor, items } = req.body;
    const v = Number(valor);
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';

    if (!nombreLimpio || nombreLimpio.length > 80) return res.status(400).json({ error: "El nombre es requerido (máximo 80 caracteres)" });
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: "Tipo de promoción inválido" });
    if (!precioValido(v) || !(v > 0 || tipo === 'precio_combo')) return res.status(400).json({ error: "Monto inválido (máximo 4 decimales)" });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Agrega al menos un producto a la promoción" });

    const normalizados = items.map(i => ({ producto_id: Number(i.producto_id), cantidad: Number(i.cantidad) }));
    if (normalizados.some(i => !Number.isInteger(i.producto_id) || !(i.cantidad > 0) || Math.round(i.cantidad * 1000) / 1000 !== i.cantidad)) {
        return res.status(400).json({ error: "Productos o cantidades inválidos" });
    }
    if (new Set(normalizados.map(i => i.producto_id)).size !== normalizados.length) {
        return res.status(400).json({ error: "Un producto no puede repetirse en la misma promoción" });
    }

    const conn = await db.getConnection();
    try {
        const [prods] = await conn.query(
            "SELECT producto_id, precio_venta FROM producto WHERE producto_id IN (?)",
            [normalizados.map(i => i.producto_id)]
        );
        if (prods.length !== normalizados.length) {
            return res.status(404).json({ error: "Alguno de los productos no existe" });
        }
        const precios = new Map(prods.map(p => [p.producto_id, Number(p.precio_venta)]));
        const promo = { tipo, valor: v, items: normalizados };
        const normal = normalizados.reduce((s, i) => s + i.cantidad * precios.get(i.producto_id), 0);
        if (ahorroPorVez(promo, precios) <= 0) {
            return res.status(400).json({ error: `El precio del combo debe ser menor al precio normal ($${redondear2(normal).toFixed(2)})` });
        }
        if (tipo === 'descuento' && v > normal) {
            return res.status(400).json({ error: `El descuento no puede ser mayor al precio normal ($${redondear2(normal).toFixed(2)})` });
        }

        await conn.beginTransaction();
        const [result] = await conn.query(
            "INSERT INTO promocion (nombre, tipo, valor) VALUES (?, ?, ?)",
            [nombreLimpio, tipo, v]
        );
        await conn.query(
            "INSERT INTO promocion_producto (promocion_id, producto_id, cantidad) VALUES ?",
            [normalizados.map(i => [result.insertId, i.producto_id, i.cantidad])]
        );
        await conn.commit();
        await logActivity(req, 'PROMOCION_CREADA', `ID ${result.insertId} · "${nombreLimpio}" · ${tipo} $${v}`);
        res.status(201).json({ message: "Promoción creada", id: result.insertId });
    } catch (error) {
        await conn.rollback();
        console.error("Error en crear promocion:", error.message);
        res.status(500).json({ error: "Error al crear la promoción" });
    } finally {
        conn.release();
    }
};

exports.cambiarEstado = async (req, res) => {
    if (!soloAdmin(req, res)) return;
    const activa = req.body.activa ? 1 : 0;
    try {
        const [result] = await db.query("UPDATE promocion SET activa = ? WHERE promocion_id = ?", [activa, req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Promoción no encontrada" });
        await logActivity(req, activa ? 'PROMOCION_ACTIVADA' : 'PROMOCION_DESACTIVADA', `ID ${req.params.id}`);
        res.json({ message: activa ? "Promoción activada" : "Promoción desactivada" });
    } catch (error) {
        console.error("Error en cambiarEstado promocion:", error.message);
        res.status(500).json({ error: "Error al actualizar la promoción" });
    }
};

exports.eliminar = async (req, res) => {
    if (!soloAdmin(req, res)) return;
    try {
        const [result] = await db.query("DELETE FROM promocion WHERE promocion_id = ?", [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Promoción no encontrada" });
        await logActivity(req, 'PROMOCION_ELIMINADA', `ID ${req.params.id}`);
        res.json({ message: "Promoción eliminada" });
    } catch (error) {
        console.error("Error en eliminar promocion:", error.message);
        res.status(500).json({ error: "Error al eliminar la promoción" });
    }
};

// Vista previa para el carrito: qué promociones aplican con los precios reales de la BD.
// El cobro vuelve a calcularlo en el servidor; esto solo es para mostrarlo al cajero.
exports.aplicar = async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: "Items inválidos" });
    try {
        const base = items.filter(i => i.producto_id && !i.presentacion_id && Number(i.qty) > 0);
        if (base.length === 0) return res.json({ aplicadas: [], descuento_total: 0 });
        const promos = await cargarActivas(db);
        if (promos.length === 0) return res.json({ aplicadas: [], descuento_total: 0 });

        const [prods] = await db.query(
            "SELECT producto_id, precio_venta FROM producto WHERE producto_id IN (?)",
            [base.map(i => i.producto_id)]
        );
        const precios = new Map(prods.map(p => [p.producto_id, Number(p.precio_venta)]));
        const lineas = base
            .filter(i => precios.has(Number(i.producto_id)))
            .map(i => ({ producto_id: Number(i.producto_id), qty: Number(i.qty), precio: precios.get(Number(i.producto_id)) }));

        const { aplicadas } = aplicarPromociones(lineas, promos);
        res.json({
            aplicadas,
            descuento_total: redondear2(aplicadas.reduce((s, a) => s + a.descuento, 0)),
        });
    } catch (error) {
        console.error("Error en aplicar promociones:", error.message);
        res.status(500).json({ error: "Error al calcular promociones" });
    }
};
