const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, saleController.createSale);

module.exports = router;