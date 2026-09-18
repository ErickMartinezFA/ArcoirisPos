// Los precios se guardan con hasta 4 decimales; subtotales y totales de venta se cobran a 2.
const redondear2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Precio válido: número finito >= 0 con máximo 4 decimales (la columna es DECIMAL(12,4)).
const precioValido = (v) =>
    typeof v === 'number' && isFinite(v) && v >= 0 && Math.round(v * 10000) / 10000 === v;

module.exports = { redondear2, precioValido };
