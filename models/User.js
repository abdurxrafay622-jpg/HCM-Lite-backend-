const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { 
        type: String, 
        enum: ['Admin', 'HR', 'Employee'], 
        required: true 
    },
    // Reference to the Employee collection (which we will build in Phase 2)
    employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    
    // Forces users (especially HR/Employees) to change password on first login
    mustChangePassword: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);