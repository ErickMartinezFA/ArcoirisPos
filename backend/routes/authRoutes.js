const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Demasiados intentos. Espera 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/login', loginLimiter, authController.login);
router.post('/logout', auth, authController.logout);
router.get('/sucursales', authController.getSucursales);
router.get('/barcode/:code', authController.barcodeSearch);

module.exports = router;
