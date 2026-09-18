// Los precios se guardan con hasta 4 decimales; los tickets y totales se cobran a 2.
export const redondear2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Importe de un renglón tal como se cobra (redondeado a centavos, igual que el servidor).
export const importeLinea = (precio, qty) =>
    redondear2((parseFloat(precio) || 0) * (parseFloat(qty) || 0));

// Precio unitario para pantalla: hasta 4 decimales, sin ceros sobrantes (mínimo 2). 12.3400 -> 12.34, 12.3456 -> 12.3456
export const fmtPrecio = (n) => Number(n || 0).toFixed(4).replace(/0{1,2}$/, '');
