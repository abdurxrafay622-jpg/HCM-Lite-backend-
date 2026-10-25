const express = require('express');
const router = express.Router();
const { login, changePassword } = require('../controllers/authController');
const { verifyJWT } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/change-password', verifyJWT, changePassword);

// Example of a protected test route (You can delete this later)
router.get('/me', verifyJWT, (req, res) => {
    res.json({ message: 'You are logged in!', user: req.user });
});

module.exports = router;