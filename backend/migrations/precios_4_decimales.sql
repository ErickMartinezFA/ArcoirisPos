-- Precios con hasta 4 decimales. Totales y subtotales de venta (venta.total, detalle_ventas.subtotal) siguen a 2.
-- Antes de correrla, revisa nulabilidad/defaults actuales:
--   SHOW COLUMNS FROM producto; SHOW COLUMNS FROM detalle_ventas; SHOW COLUMNS FROM presentacion;
-- MODIFY reemplaza la definición completa de la columna, así que ajusta NULL/NOT NULL/DEFAULT si difieren.

ALTER TABLE producto
  MODIFY precio_compra DECIMAL(12, 4) NOT NULL,
  MODIFY precio_venta  DECIMAL(12, 4) NOT NULL;

ALTER TABLE presentacion
  MODIFY precio_venta DECIMAL(12, 4) NOT NULL;

ALTER TABLE detalle_ventas
  MODIFY precio_unitario DECIMAL(12, 4) NOT NULL;
