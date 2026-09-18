// Ticket para impresora térmica de papel de 57 mm.
// El área imprimible real de estas impresoras es ~48 mm; se centra en el papel con margin auto.
// Si el ticket sale cortado de un lado, baja ANCHO_MM; si sobra espacio, súbelo (máx. ~54).
const PAPEL_MM = 57;
const ANCHO_MM = 48;

const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dinero = (n) => `$${Number(n || 0).toFixed(2)}`;

// items: [{ nombre, cantidad, unidad, precioUnitario, subtotal }]
// Abre una ventana solo con el ticket y manda imprimir desde ahí: así el CSS de impresión
// de la app no oculta el ticket junto con el #root.
export const imprimirTicket = ({ ventaId, fecha = new Date(), operador, sucursal, items, total, pagoCon, cambio }) => {
    const renglones = items.map(i => `
      <div class="item">
        <div class="nombre">${escHtml(i.nombre)}</div>
        <div class="row">
          <span>${Number(i.cantidad)} ${escHtml(i.unidad)} × ${dinero(i.precioUnitario)}</span>
          <span class="bold">${dinero(i.subtotal)}</span>
        </div>
      </div>`).join('');

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
           width: ${ANCHO_MM}mm; margin: 0 auto; padding: 2mm 0 6mm; }
    .center { text-align: center; }
    .bold { font-weight: 800; }
    .titulo { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
    .divider { border-top: 1.5px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
    .item { margin-bottom: 6px; }
    .nombre { font-weight: 800; word-break: break-word; }
    .total { font-size: 16px; font-weight: 900; }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:6px">
    <div class="titulo">EL ARCOIRIS</div>
    <div>Todo para el carpintero</div>
    <div style="margin-top:4px">${escHtml(new Date(fecha).toLocaleString('es-MX'))}</div>
    <div>Ticket #${escHtml(ventaId)}</div>
    <div>Atendido por: ${escHtml(operador)}</div>
    ${sucursal ? `<div>${escHtml(sucursal)}</div>` : ''}
  </div>
  <div class="divider"></div>
  ${renglones}
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
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
};
