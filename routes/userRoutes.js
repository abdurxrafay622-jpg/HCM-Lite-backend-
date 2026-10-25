const express = require('express');
const router = express.Router();
const { createHR } = require('../controllers/adminController');
const { registerEmployee } = require('../controllers/hrController');
const { verifyJWT, checkRole } = require('../middleware/authMiddleware');

router.post('/admin/create-hr', verifyJWT, checkRole(['Admin']), createHR);
router.post('/hr/register-employee', verifyJWT, checkRole(['HR']), registerEmployee);

module.exports = router;