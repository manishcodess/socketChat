const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/config', authController.getAuthConfig);
router.post('/config', authController.saveAuthConfig);
router.get('/users', authController.getUsers);

module.exports = router;
