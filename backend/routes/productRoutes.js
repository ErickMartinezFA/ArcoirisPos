const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const auth = require('../middleware/authMiddleware');

router.get('/', productController.getAllProducts);
router.get('/:barcode', productController.getProductByBarcode);

// Ruta protegida: Solo si mandas el token en el header 'x-auth-token'
router.post('/', auth, productController.createProduct);

// Rutas de Productos e Inventario
router.post('/products', productController.createProduct);

// Ruta para llenar el select del formulario (DINÁMICO)
router.get('/sucursales', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT sucursal_id, nombre FROM sucursal");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener sucursales" });
    }
});

module.exports = router;