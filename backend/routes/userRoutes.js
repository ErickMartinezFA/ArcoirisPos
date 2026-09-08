const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/', userController.createUser);
router.delete('/:id', userController.deleteUser);
router.put('/:id/reset-password', userController.resetPassword);

module.exports = router;