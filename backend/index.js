require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const auth = require("./middleware/authMiddleware");

const productController = require('./controllers/productController');
const inventoryController = require('./controllers/inventoryController');
const authRoutes = require("./routes/authRoutes");
const reportRoutes = require("./routes/reportRoutes");
const userRoutes = require("./routes/userRoutes");
const logActivity = require('./utils/logActivity');

const app = express();
const allowedOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? null : '*');
if (!allowedOrigin) { console.error('CORS_ORIGIN no está configurado'); process.exit(1); }
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.get("/", (req, res) => res.sendStatus(200));

// Productos e inventario
app.get('/api/products', auth, productController.getProducts);
app.post('/api/products', auth, productController.createProduct);
app.put('/api/products/:id', auth, productController.updateProduct);
app.get('/api/sucursales', auth, productController.getSucursales);
app.get('/api/inventory/report', auth, inventoryController.getInventoryReport);
app.put('/api/inventory/add', auth, inventoryController.addStock);
app.post('/api/inventory/transfer', auth, inventoryController.transferStock);

// Reportes y usuarios
app.use("/api/reports", reportRoutes);
app.use("/api/users", auth, userRoutes);

// Ventas — usuario_id y sucursal_id se toman del JWT, nunca del body
app.post('/api/sales', auth, async (req, res) => {
    const { items, total, sucursal_id: sucursalBody } = req.body;
    const usuario_id = req.user.usuario_id;
    // Admins pueden operar en cualquier sucursal (switcher del sidebar); vendedores usan la del JWT
    const sucursal_id = req.user.rol === 'admin' && sucursalBody ? sucursalBody : req.user.sucursal_id;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "La venta debe tener al menos un producto" });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Total se calculará server-side una vez verificados los precios
        const [resultVenta] = await conn.query(
            "INSERT INTO venta (total, fecha, usuario_id, sucursal_id) VALUES (?, NOW(), ?, ?)",
            [0, usuario_id, sucursal_id]
        );
        const ventaId = resultVenta.insertId;

        for (const item of items) {
            if (!item.producto_id || !(item.qty > 0)) {
                await conn.rollback();
                return res.status(400).json({ error: "Datos de producto inválidos" });
            }

            // Precio oficial desde la DB — el cliente no puede manipularlo
            const [prodRows] = await conn.query(
                "SELECT precio_venta FROM producto WHERE producto_id = ?",
                [item.producto_id]
            );
            if (!prodRows[0]) {
                await conn.rollback();
                return res.status(400).json({ error: `Producto no encontrado: ${item.producto_id}` });
            }
            const precioOficial = Number(prodRows[0].precio_venta);

            const [stockRows] = await conn.query(
                "SELECT stock_actual FROM inventario WHERE producto_id = ? AND sucursal_id = ?",
                [item.producto_id, sucursal_id]
            );
            const stockDisponible = stockRows[0]?.stock_actual ?? 0;

            if (stockDisponible < item.qty) {
                await conn.rollback();
                return res.status(400).json({ error: `Stock insuficiente para "${item.nombre}"` });
            }

            const subtotal = item.qty * precioOficial;
            await conn.query(
                "INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)",
                [ventaId, item.producto_id, item.qty, precioOficial, subtotal]
            );
            await conn.query(
                "UPDATE inventario SET stock_actual = stock_actual - ? WHERE producto_id = ? AND sucursal_id = ?",
                [item.qty, item.producto_id, sucursal_id]
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
        await logActivity(req, 'VENTA', `Venta #${ventaId} · Total $${totalReal} · Sucursal ${sucursal_id}`);
        res.json({ message: "Venta registrada", ventaId, total: totalReal });
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
