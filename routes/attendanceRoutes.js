const express = require('express');
const router = express.Router();

const {
    checkIn,
    checkOut,
    myAttendance,
    todayBoard,
    requestCorrection,
    pendingCorrections,
    decideCorrection
} = require('../controllers/attendanceController');

const { verifyJWT, checkRole } = require('../middleware/authMiddleware');

router.post('/check-in', verifyJWT, checkRole(['Employee']), checkIn);
router.post('/check-out', verifyJWT, checkRole(['Employee']), checkOut);
router.get('/my', verifyJWT, checkRole(['Employee']), myAttendance);
router.post('/correction', verifyJWT, checkRole(['Employee']), requestCorrection);

router.get('/today', verifyJWT, checkRole(['HR', 'Admin']), todayBoard);
router.get('/corrections', verifyJWT, checkRole(['HR']), pendingCorrections);
router.put('/corrections/:id', verifyJWT, checkRole(['HR']), decideCorrection);

module.exports = router;