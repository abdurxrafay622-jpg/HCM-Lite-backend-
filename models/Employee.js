const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    department: { type: String, required: true },
    designation: { type: String, required: true },
    salaryBasic: { type: Number, required: true },
    joiningDate: { type: Date, default: Date.now },

    // Used for headcount and attrition
    status: {
        type: String,
        enum: ['Active', 'Exited'],
        default: 'Active'
    },
    exitDate: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);