const express = require('express');
const router = express.Router();
const { updateSettings, createDepartment } = require('../controllers/orgController');
const { verifyJWT, checkRole } = require('../middleware/authMiddleware');

// All routes here require login AND Admin role
router.use(verifyJWT, checkRole(['Admin']));

router.post('/settings', updateSettings);
router.post('/departments', createDepartment);

module.exports = router;