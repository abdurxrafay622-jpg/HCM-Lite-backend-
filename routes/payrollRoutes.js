const express = require('express');

const router = express.Router();

const {
    generatePayroll,
    getPayrollRuns,
    finalizePayroll,
    myPayslips,
    getMonthlyPayslips
} = require('../controllers/payrollController');

const {
    verifyJWT,
    checkRole
} = require('../middleware/authMiddleware');


// HR generates payroll
router.post(
    '/generate',
    verifyJWT,
    checkRole(['HR']),
    generatePayroll
);


// HR/Admin view payroll runs
router.get(
    '/runs',
    verifyJWT,
    checkRole(['HR', 'Admin']),
    getPayrollRuns
);


// Admin finalizes payroll
router.put(
    '/finalize/:id',
    verifyJWT,
    checkRole(['Admin']),
    finalizePayroll
);


// Employee views own payslips
router.get(
    '/my-payslips',
    verifyJWT,
    checkRole(['Employee']),
    myPayslips
);


// HR/Admin view monthly payslips
router.get(
    '/payslips/:month',
    verifyJWT,
    checkRole(['HR', 'Admin']),
    getMonthlyPayslips
);


module.exports = router;