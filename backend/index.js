require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const auth = require("./middleware/authMiddleware");

const productController = require('./controllers/productController');
const inventoryController = require('./controllers/inventoryController');
const presentacionController = require('./controllers/presentacionController');
const promocionController = require('./controllers/promocionController');
const devolucionController = require('./controllers/devolucionController');
const authRoutes = require("./routes/authRoutes");
const reportRoutes = require("./routes/reportRoutes");
const userRoutes = require("./routes/userRoutes");
const logActivity = require('./utils/logActivity');
const { redondear2 } = require('./utils/precio');
const { cargarActivas, aplicarPromociones } = require('./utils/promociones');

const app = express();
app.set('trust proxy', 1);
const allowedOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? null : '*');
if (!allowedOrigin) { console.error('CORS_ORIGIN no está configurado'); process.exit(1); }
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

db.query(`
    CREATE TABLE IF NOT EXISTS presentacion (
        presentacion_id INT AUTO_INCREMENT PRIMARY KEY,
        producto_id INT NOT NULL,
        nombre VARCHAR(50) NOT NULL,
        cantidad DECIMAL(10, 3) NOT NULL,
        precio_venta DECIMAL(12, 4) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (producto_id) REFERENCES producto(producto_id) ON DELETE CASCADE
    )
`).catch(err => console.error('Error creando tabla presentacion:', err.message));

// movimientos_inventario.tipo nació como ENUM('entrada','transferencia'); el descuento manual y las
// devoluciones necesitan 'salida' y 'devolucion'. Se conservan los valores existentes y solo se agrega lo faltante.
(async () => {
    try {
        const [[col]] = await db.query(
            `SELECT COLUMN_TYPE AS tipo FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'movimientos_inventario' AND COLUMN_NAME = 'tipo'`
        );
        if (col && /^enum\(/i.test(col.tipo)) {
            let tipo = col.tipo;
            for (const valor of ['salida', 'devolucion']) {
                if (!tipo.includes(`'${valor}'`)) tipo = tipo.replace(/\)$/, `,'${valor}')`);
            }
            if (tipo !== col.tipo) {
                await db.query(`ALTER TABLE movimientos_inventario MODIFY tipo ${tipo} NOT NULL`);
                console.log("movimientos_inventario.tipo actualizado:", tipo);
            }
        }
    } catch (err) {
        console.error("Error ajustando movimientos_inventario.tipo:", err.message);
    }
})();

// Método de pago de cada venta. Se agrega la columna si no existe (ventas viejas quedan en 'efectivo').
(async () => {
    try {
        const [[col]] = await db.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'venta' AND COLUMN_NAME = 'metodo_pago'`
        );
        if (!col) {
            await db.query(
                `ALTER TABLE venta ADD COLUMN metodo_pago ENUM('efectivo','tarjeta','transferencia') NOT NULL DEFAULT 'efectivo'`
            );
            console.log("venta.metodo_pago agregada");
        }
    } catch (err) {
        console.error("Error agregando venta.metodo_pago:", err.message);
    }
})();

// Devoluciones/cambios: quedan ligadas a la venta y al renglón exacto (detalle_ventas), para no
// poder devolver más de lo que ese ticket vendió. Cada devolución regresa stock a la sucursal
// donde se hizo la venta y queda registrada como movimiento de inventario tipo 'devolucion'.
(async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS devolucion (
                devolucion_id INT AUTO_INCREMENT PRIMARY KEY,
                venta_id INT NOT NULL,
                usuario_id INT,
                motivo VARCHAR(255) NOT NULL,
                total DECIMAL(10, 2) NOT NULL,
                fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (venta_id) REFERENCES venta(venta_id),
                FOREIGN KEY (usuario_id) REFERENCES usuario(usuario_id) ON DELETE SET NULL
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS devolucion_detalle (
                id INT AUTO_INCREMENT PRIMARY KEY,
                devolucion_id INT NOT NULL,
                detalle_id INT NOT NULL,
                producto_id INT NOT NULL,
                cantidad DECIMAL(10, 2) NOT NULL,
                monto DECIMAL(10, 2) NOT NULL,
                FOREIGN KEY (devolucion_id) REFERENCES devolucion(devolucion_id) ON DELETE CASCADE,
                FOREIGN KEY (detalle_id) REFERENCES detalle_ventas(detalle_id),
                FOREIGN KEY (producto_id) REFERENCES producto(producto_id)
            )
        `);
    } catch (err) {
        console.error('Error creando tablas de devolucion:', err.message);
    }
})();

// Promociones tipo combo (ej. producto A + producto B a precio especial)
(async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS promocion (
                promocion_id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(80) NOT NULL,
                tipo ENUM('precio_combo', 'descuento') NOT NULL,
                valor DECIMAL(12, 4) NOT NULL,
                activa TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS promocion_producto (
                promocion_id INT NOT NULL,
                producto_id INT NOT NULL,
                cantidad DECIMAL(10, 3) NOT NULL,
                PRIMARY KEY (promocion_id, producto_id),
                FOREIGN KEY (promocion_id) REFERENCES promocion(promocion_id) ON DELETE CASCADE,
                FOREIGN KEY (producto_id) REFERENCES producto(producto_id) ON DELETE CASCADE
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS venta_promocion (
                id INT AUTO_INCREMENT PRIMARY KEY,
                venta_id INT NOT NULL,
                promocion_id INT NULL,
                nombre VARCHAR(80) NOT NULL,
                veces INT NOT NULL,
                descuento DECIMAL(10, 2) NOT NULL,
                INDEX idx_venta_promocion_venta (venta_id)
            )
        `);
    } catch (err) {
        console.error('Error creando tablas de promociones:', err.message);
    }
})();

app.use("/api/auth", authRoutes);
app.get("/", (req, res) => res.sendStatus(200));

// Productos e inventario
app.get('/api/products', auth, productController.getProducts);
app.post('/api/products', auth, productController.createProduct);
app.put('/api/products/:id', auth, productController.updateProduct);
app.get('/api/sucursales', auth, productController.getSucursales);
app.get('/api/inventory/report', auth, inventoryController.getInventoryReport);
app.put('/api/inventory/add', auth, inventoryController.addStock);
app.put('/api/inventory/remove', auth, inventoryController.removeStock);
app.post('/api/inventory/transfer', auth, inventoryController.transferStock);

// Presentaciones de venta (ej. aceite a granel: 0.5L, 1L con precio fijo, mismo inventario)
app.get('/api/presentaciones/:producto_id', auth, presentacionController.getByProducto);
app.post('/api/presentaciones', auth, presentacionController.create);
app.delete('/api/presentaciones/:id', auth, presentacionController.remove);

// Promociones: el admin las administra; /aplicar lo usa la pantalla de ventas para mostrar el ahorro
app.post('/api/promotions/aplicar', auth, promocionController.aplicar);
app.get('/api/promotions', auth, promocionController.listar);
app.post('/api/promotions', auth, promocionController.crear);
app.patch('/api/promotions/:id', auth, promocionController.cambiarEstado);
app.delete('/api/promotions/:id', auth, promocionController.eliminar);

// Devoluciones/cambios sobre una venta ya cobrada
app.get('/api/devoluciones/venta/:venta_id', auth, devolucionController.getVentaParaDevolucion);
app.post('/api/devoluciones', auth, devolucionController.crear);

// Reportes y usuarios
app.use("/api/reports", reportRoutes);
app.use("/api/users", auth, userRoutes);

const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia'];

// Ventas — usuario_id y sucursal_id se toman del JWT, nunca del body
app.post('/api/sales', auth, async (req, res) => {
    const { items, total, sucursal_id: sucursalBody, metodo_pago } = req.body;
    const usuario_id = req.user.usuario_id;
    // Admins pueden operar en cualquier sucursal (switcher del sidebar); vendedores usan la del JWT
    const sucursal_id = req.user.rol === 'admin' && sucursalBody ? sucursalBody : req.user.sucursal_id;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "La venta debe tener al menos un producto" });
    }
    if (!METODOS_PAGO.includes(metodo_pago)) {
        return res.status(400).json({ error: "Método de pago inválido" });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Total se calculará server-side una vez verificados los precios
        const [resultVenta] = await conn.query(
            "INSERT INTO venta (total, fecha, usuario_id, sucursal_id, metodo_pago) VALUES (?, NOW(), ?, ?, ?)",
            [0, usuario_id, sucursal_id, metodo_pago]
        );
        const ventaId = resultVenta.insertId;

        // Pasada 1: precio real (BD), stock y descuento de inventario. Los renglones se guardan
        // en la pasada 2, cuando ya se conocen las promociones que aplican.
        const lineas = [];
        for (const item of items) {
            if (!item.producto_id || !(item.qty > 0)) {
                await conn.rollback();
                return res.status(400).json({ error: "Datos de producto inválidos" });
            }

            let cantidadDescontar; // cantidad real en unidad base a restar del inventario
            let subtotal;          // monto real a cobrar
            let precioUnitario;    // para reportes de utilidad, expresado por unidad base
            let precioBase = null; // precio por unidad base; solo los renglones sin presentación participan en promociones

            if (item.presentacion_id) {
                // Venta por presentación (ej. "0.5L" con precio fijo) — precio e inventario
                // se derivan siempre de la BD, nunca del cliente.
                const [presRows] = await conn.query(
                    "SELECT cantidad, precio_venta FROM presentacion WHERE presentacion_id = ? AND producto_id = ?",
                    [item.presentacion_id, item.producto_id]
                );
                if (!presRows[0]) {
                    await conn.rollback();
                    return res.status(400).json({ error: `Presentación no encontrada para el producto ${item.producto_id}` });
                }
                cantidadDescontar = Number(presRows[0].cantidad) * item.qty;
                const subtotalExacto = Number(presRows[0].precio_venta) * item.qty;
                precioUnitario = subtotalExacto / cantidadDescontar;
                subtotal = redondear2(subtotalExacto);
            } else {
                // Precio oficial desde la DB — el cliente no puede manipularlo
                const [prodRows] = await conn.query(
                    "SELECT precio_venta FROM producto WHERE producto_id = ?",
                    [item.producto_id]
                );
                if (!prodRows[0]) {
                    await conn.rollback();
                    return res.status(400).json({ error: `Producto no encontrado: ${item.producto_id}` });
                }
                precioUnitario = Number(prodRows[0].precio_venta);
                precioBase = precioUnitario;
                cantidadDescontar = item.qty;
                subtotal = redondear2(item.qty * precioUnitario);
            }

            const [stockRows] = await conn.query(
                "SELECT stock_actual FROM inventario WHERE producto_id = ? AND sucursal_id = ? FOR UPDATE",
                [item.producto_id, sucursal_id]
            );
            const stockDisponible = stockRows[0]?.stock_actual ?? 0;

            if (stockDisponible < cantidadDescontar) {
                await conn.rollback();
                return res.status(400).json({ error: `Stock insuficiente para "${item.nombre}"` });
            }

            await conn.query(
                "UPDATE inventario SET stock_actual = stock_actual - ? WHERE producto_id = ? AND sucursal_id = ?",
                [cantidadDescontar, item.producto_id, sucursal_id]
            );
            lineas.push({ producto_id: Number(item.producto_id), qty: item.qty, precioBase, cantidadDescontar, subtotal, precioUnitario });
        }

        // Promociones: se recalculan aquí con los precios de la BD, nunca con lo que mande el cliente.
        // El descuento de cada producto se reparte en sus renglones, así subtotal y precio_unitario
        // quedan netos y los reportes de ingresos/utilidad ya lo reflejan.
        const promos = await cargarActivas(conn);
        const { aplicadas, descuentoPorProducto } = aplicarPromociones(
            lineas.filter(l => l.precioBase != null).map(l => ({ producto_id: l.producto_id, qty: l.qty, precio: l.precioBase })),
            promos
        );
        for (const [productoId, descuento] of descuentoPorProducto) {
            const propias = lineas.filter(l => l.precioBase != null && l.producto_id === productoId);
            const base = propias.reduce((sum, l) => sum + l.subtotal, 0);
            let repartido = 0;
            propias.forEach((l, idx) => {
                const parte = idx === propias.length - 1
                    ? redondear2(descuento - repartido)
                    : redondear2(descuento * (l.subtotal / base));
                repartido = redondear2(repartido + parte);
                l.subtotal = redondear2(l.subtotal - parte);
                l.precioUnitario = l.subtotal / l.cantidadDescontar;
            });
        }

        // Pasada 2: guardar renglones y promociones aplicadas
        for (const l of lineas) {
            await conn.query(
                "INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)",
                [ventaId, l.producto_id, l.cantidadDescontar, l.precioUnitario, l.subtotal]
            );
        }
        for (const a of aplicadas) {
            await conn.query(
                "INSERT INTO venta_promocion (venta_id, promocion_id, nombre, veces, descuento) VALUES (?, ?, ?, ?, ?)",
                [ventaId, a.promocion_id, a.nombre, a.veces, a.descuento]
            );
        }

        // Actualizar total real calculado en el servidor
        const [totRow] = await conn.query(
            "SELECT COALESCE(SUM(subtotal), 0) AS total FROM detalle_ventas WHERE id_venta = ?",
            [ventaId]
        );
        const totalReal = Number(totRow[0].total);
        await conn.query("UPDATE venta SET total = ? WHERE venta_id = ?", [totalReal, ventaId]);

        await conn.commit();
        const notaPromos = aplicadas.length ? ` · Promos: ${aplicadas.map(a => `${a.nombre} x${a.veces} -$${a.descuento}`).join(', ')}` : '';
        await logActivity(req, 'VENTA', `Venta #${ventaId} · Total $${totalReal} · Sucursal ${sucursal_id}${notaPromos}`);
        res.json({ message: "Venta registrada", ventaId, total: totalReal, descuentos: aplicadas });
    } catch (error) {
        await conn.rollback();
        console.error("Error en /api/sales:", error.message);
        res.status(500).json({ error: "Error al procesar la venta" });
    } finally {
        conn.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Arcoiris en puerto ${PORT}`));
