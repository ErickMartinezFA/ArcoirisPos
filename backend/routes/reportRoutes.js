const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/authMiddleware');

router.get('/daily/:sucursal_id', auth, reportController.getDailySales);
router.get('/top-products', auth, reportController.getTopProducts);
router.get('/history', auth, reportController.getSalesHistory);
router.get('/users-sales', auth, reportController.getUsersSales);
router.get('/sale/:venta_id', auth, reportController.getSaleDetail);
router.get('/low-stock/:sucursal_id', auth, reportController.getLowStock);
router.get('/top-utility', auth, reportController.getTopByUtility);
router.get('/movimientos', auth, reportController.getMovimientos);
router.get('/actividad', auth, reportController.getActividad);

module.exports = router;
