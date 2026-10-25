const User = require('../models/User');
const bcrypt = require('bcrypt');

const setupFirstAdmin = async () => {
    try {
        // Check if an Admin already exists
        const adminExists = await User.findOne({ role: 'Admin' });

        if (!adminExists) {
            console.log('No Admin found. Creating initial Admin from .env variables...');
            
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, salt);

            await User.create({
                email: process.env.ADMIN_EMAIL,
                password: hashedPassword,
                role: 'Admin',
                mustChangePassword: false // Admin setup via env doesn't need force change
            });

            console.log('Initial Admin account created successfully.');
        } else {
            console.log('Admin account already exists. Skipping first-run setup.');
        }
    } catch (error) {
        console.error('Error in first-run setup:', error);
    }
};

module.exports = setupFirstAdmin;