import logoTicket from './assets/logo-ticket.png?inline';

// Ticket para impresora térmica de papel de 57 mm.
// El cabezal imprime ~48 mm (384 puntos) y el driver ubica el origen de la página en el primer
// punto del cabezal, NO en el borde del papel: centrar el contenido en los 57 mm lo corre a la
// derecha y se corta ese margen (~4.5 mm). Por eso el ticket va pegado a la izquierda del área
// imprimible, con un poco de holgura. Si aún se corta a la derecha, baja ANCHO_MM;
// si sobra espacio a la derecha, súbelo (máx. 48).
const PAPEL_MM = 57;
const ANCHO_MM = 46;
const MARGEN_IZQ_MM = 1;
// logo-ticket.png: hexágono en escala de grises ya tramado a 1 bit, 384 px = 48 mm a 203 dpi.
// Se imprime sin suavizado para que cada punto sea un punto de la impresora.

const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dinero = (n) => `$${Number(n || 0).toFixed(2)}`;

// items: [{ nombre, cantidad, unidad, precioUnitario, subtotal }]
// promociones: [{ nombre, veces, descuento }]. Con promosIncluidas=false (venta nueva) se restan del subtotal
// de los renglones; con true (reimpresión) los subtotales ya vienen con el descuento y solo se informa el ahorro.
// Abre una ventana solo con el ticket y manda imprimir desde ahí: así el CSS de impresión
// de la app no oculta el ticket junto con el #root.
export const imprimirTicket = ({ ventaId, fecha = new Date(), operador, sucursal, items, total, pagoCon, cambio, promociones = [], promosIncluidas = false }) => {
    const renglones = items.map(i => `
      <div class="item">
        <div class="nombre">${escHtml(i.nombre)}</div>
        <div class="row">
          <span>${Number(i.cantidad)} ${escHtml(i.unidad)} × ${dinero(i.precioUnitario)}</span>
          <span class="bold">${dinero(i.subtotal)}</span>
        </div>
      </div>`).join('');

    const promos = promociones.map(p => {
        const veces = p.veces > 1 ? ` x${p.veces}` : '';
        return promosIncluidas
            ? `<div class="promo">Incluye promo: ${escHtml(p.nombre)}${veces} (ahorro ${dinero(p.descuento)})</div>`
            : `<div class="row"><span>Promo ${escHtml(p.nombre)}${veces}</span><span class="bold">-${dinero(p.descuento)}</span></div>`;
    }).join('');

    const pago = pagoCon != null ? `
      <div class="row"><span>Efectivo</span><span>${dinero(pagoCon)}</span></div>
      <div class="row bold"><span>Cambio</span><span>${dinero(cambio)}</span></div>` : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Ticket #${escHtml(ventaId)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: ${PAPEL_MM}mm auto; margin: 0; }
    html, body { background: #fff; color: #000; }
    /* Sans-serif en negrita: el Courier New fino sale desvaído en papel térmico */
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 600; line-height: 1.3;
           width: ${ANCHO_MM}mm; margin: 0 0 0 ${MARGEN_IZQ_MM}mm; padding: 2mm 0 6mm; }
    .logo { display: block; width: 100%; height: auto; image-rendering: pixelated; }
    .center { text-align: center; }
    .bold { font-weight: 800; }
    .titulo { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
    .divider { border-top: 1.5px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
    .item { margin-bottom: 6px; }
    .nombre { font-weight: 800; word-break: break-word; }
    .total { font-size: 16px; font-weight: 900; }
    .promo { font-size: 11px; word-break: break-word; }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:6px">
    <img class="logo" src="${logoTicket}" alt=""/>
    <div class="titulo">EL ARCOIRIS</div>
    <div>Todo para el carpintero</div>
    <div style="margin-top:4px">${escHtml(new Date(fecha).toLocaleString('es-MX'))}</div>
    <div>Ticket #${escHtml(ventaId)}</div>
    <div>Atendido por: ${escHtml(operador)}</div>
    ${sucursal ? `<div>${escHtml(sucursal)}</div>` : ''}
  </div>
  <div class="divider"></div>
  ${renglones}
  ${promos ? `<div class="divider"></div>${promos}` : ''}
  <div class="divider"></div>
  <div class="row total"><span>TOTAL</span><span>${dinero(total)}</span></div>
  ${pago}
  <div class="divider"></div>
  <div class="center">¡Gracias por su compra!</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=350,height=600');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    const imprimir = () => { win.focus(); win.print(); win.close(); };
    // Espera a que el logo cargue; si no, sale el ticket sin él.
    const logo = win.document.images[0];
    if (logo && !logo.complete) {
        logo.onload = logo.onerror = () => setTimeout(imprimir, 100);
    } else {
        setTimeout(imprimir, 300);
    }
};
