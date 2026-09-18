const { redondear2 } = require('./precio');

// Carga las promociones activas con sus productos: [{ promocion_id, nombre, tipo, valor, items: [{ producto_id, cantidad }] }]
// `dbLike` puede ser el pool o una conexión dentro de una transacción.
const cargarActivas = async (dbLike) => {
    const [promos] = await dbLike.query(
        "SELECT promocion_id, nombre, tipo, valor FROM promocion WHERE activa = 1"
    );
    if (promos.length === 0) return [];
    const [items] = await dbLike.query(
        "SELECT promocion_id, producto_id, cantidad FROM promocion_producto WHERE promocion_id IN (?)",
        [promos.map(p => p.promocion_id)]
    );
    return promos.map(p => ({
        promocion_id: p.promocion_id,
        nombre: p.nombre,
        tipo: p.tipo,
        valor: Number(p.valor),
        items: items
            .filter(i => i.promocion_id === p.promocion_id)
            .map(i => ({ producto_id: i.producto_id, cantidad: Number(i.cantidad) })),
    }));
};

// Ahorro por cada vez que se cumple la promoción, con los precios vigentes.
// "precio_combo": el combo cuesta `valor` en total; "descuento": se descuentan `valor` pesos.
const ahorroPorVez = (promo, precios) => {
    const normal = promo.items.reduce((s, i) => s + i.cantidad * (precios.get(i.producto_id) ?? 0), 0);
    const ahorro = promo.tipo === 'precio_combo' ? normal - promo.valor : promo.valor;
    return Math.min(ahorro, normal);
};

// lineas: [{ producto_id, qty, precio }] — solo renglones vendidos por unidad base
// (las presentaciones ya tienen su precio fijo y no participan).
// Devuelve:
//   aplicadas: [{ promocion_id, nombre, veces, descuento }]
//   descuentoPorProducto: Map(producto_id -> descuento total repartido a ese producto)
// Cada unidad participa en una sola promoción; se aplican primero las que más ahorran.
// Si el cliente lleva más del mínimo, solo cuentan los combos completos.
const aplicarPromociones = (lineas, promos) => {
    const disponible = new Map();
    const precios = new Map();
    for (const l of lineas) {
        disponible.set(l.producto_id, (disponible.get(l.producto_id) || 0) + Number(l.qty));
        precios.set(l.producto_id, Number(l.precio));
    }

    const candidatas = promos
        .filter(p => p.items.length > 0)
        .map(p => ({ promo: p, ahorro: ahorroPorVez(p, precios) }))
        .filter(c => c.ahorro > 0)
        .sort((a, b) => b.ahorro - a.ahorro);

    const aplicadas = [];
    const descuentoPorProducto = new Map();

    for (const { promo, ahorro } of candidatas) {
        const veces = Math.floor(Math.min(
            ...promo.items.map(i => (disponible.get(i.producto_id) || 0) / i.cantidad)
        ) + 1e-9);
        if (!(veces >= 1)) continue;

        for (const i of promo.items) {
            disponible.set(i.producto_id, disponible.get(i.producto_id) - i.cantidad * veces);
        }

        const descuento = redondear2(ahorro * veces);
        // Se reparte entre los productos del combo en proporción a lo que valen (el último absorbe el redondeo)
        const pesos = promo.items.map(i => i.cantidad * veces * precios.get(i.producto_id));
        const base = pesos.reduce((s, x) => s + x, 0);
        let repartido = 0;
        promo.items.forEach((i, idx) => {
            const parte = idx === promo.items.length - 1
                ? redondear2(descuento - repartido)
                : redondear2(descuento * (pesos[idx] / base));
            repartido = redondear2(repartido + parte);
            descuentoPorProducto.set(i.producto_id, redondear2((descuentoPorProducto.get(i.producto_id) || 0) + parte));
        });

        aplicadas.push({ promocion_id: promo.promocion_id, nombre: promo.nombre, veces, descuento });
    }

    return { aplicadas, descuentoPorProducto };
};

module.exports = { cargarActivas, aplicarPromociones, ahorroPorVez };
