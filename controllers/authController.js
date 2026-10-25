const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Find User
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        // 2. Check Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        // 3. Generate JWT Token
        const token = jwt.sign(
            { id: user._id, role: user.role, employee_id: user.employee_id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            role: user.role,
            mustChangePassword: user.mustChangePassword
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// POST /api/auth/change-password
exports.changePassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.user.id; // Comes from auth middleware

        if (!newPassword) return res.status(400).json({ message: 'New password is required' });

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update user
        await User.findByIdAndUpdate(userId, {
            password: hashedPassword,
            mustChangePassword: false
        });

        res.status(200).json({ message: 'Password updated successfully. You can now use the app.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};