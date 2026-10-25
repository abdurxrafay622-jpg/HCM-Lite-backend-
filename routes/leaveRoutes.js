const express = require('express');
const router = express.Router();

const {
    applyLeave,
    myLeaves,
    pendingLeaves,
    allLeaves,
    approveLeave
} = require('../controllers/leaveController');

const { verifyJWT, checkRole } = require('../middleware/authMiddleware');

router.post('/apply', verifyJWT, checkRole(['Employee']), applyLeave);
router.get('/my', verifyJWT, checkRole(['Employee']), myLeaves);
router.get('/pending', verifyJWT, checkRole(['HR']), pendingLeaves);
router.get('/all', verifyJWT, checkRole(['HR']), allLeaves);
router.put('/approve/:id', verifyJWT, checkRole(['HR']), approveLeave);

module.exports = router;