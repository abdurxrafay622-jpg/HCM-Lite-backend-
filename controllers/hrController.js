const Employee = require('../models/Employee');
const User = require('../models/User');
const bcrypt = require('bcrypt');

// POST /api/users/hr/register-employee (HR Only)
exports.registerEmployee = async (req, res) => {
    try {
        const { name, email, department, designation, salaryBasic } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'Email already in use' });

        // Create the Employee profile
        const newEmployee = await Employee.create({
            name, department, designation, salaryBasic
        });

        // Generate a temporary password
        const tempPassword = `Emp@${Math.floor(1000 + Math.random() * 9000)}`;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        // Create the User login linked to the Employee
        const newUser = await User.create({
            email,
            password: hashedPassword,
            role: 'Employee',
            employee_id: newEmployee._id,
            mustChangePassword: true
        });

        res.status(201).json({
            message: 'Employee registered successfully',
            employee: newEmployee,
            loginDetails: {
                email: newUser.email,
                temporaryPassword: tempPassword
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};