const express = require('express');
const router = express.Router();

const {
    listDepartments,
    adminDashboard,
    hrDashboard,
    employeeDashboard
} = require('../controllers/dashboardController');

const { verifyJWT, checkRole } = require('../middleware/authMiddleware');

router.get('/departments', verifyJWT, checkRole(['Admin', 'HR']), listDepartments);
router.get('/admin', verifyJWT, checkRole(['Admin']), adminDashboard);
router.get('/hr', verifyJWT, checkRole(['HR']), hrDashboard);
router.get('/employee', verifyJWT, checkRole(['Employee']), employeeDashboard);

module.exports = router;