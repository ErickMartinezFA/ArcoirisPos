const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const auth = require('../middleware/authMiddleware');

// Actualizar stock (Entrada de mercancía)
router.put('/adjust', auth, inventoryController.updateStock);

// Ver reporte de stock de una sucursal
router.get('/:sucursal_id', auth, inventoryController.getStockByBranch);

module.exports = router;