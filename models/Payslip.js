const mongoose = require('mongoose');

const payslipSchema = new mongoose.Schema({

    payrollRun: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollRun',
        required: true
    },

    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },

    month: {
        type: String,
        required: true
    },

    basicSalary: {
        type: Number,
        required: true
    },

    hra: {
        type: Number,
        default: 0
    },

    medicalAllowance: {
        type: Number,
        default: 0
    },

    grossSalary: {
        type: Number,
        required: true
    },

    absentDays: {
        type: Number,
        default: 0
    },

    halfDays: {
        type: Number,
        default: 0
    },

    unpaidLeaveDays: {
        type: Number,
        default: 0
    },

    attendanceDeduction: {
        type: Number,
        default: 0
    },

    tax: {
        type: Number,
        default: 0
    },

    totalDeductions: {
        type: Number,
        default: 0
    },

    netSalary: {
        type: Number,
        required: true
    }

}, { timestamps: true });

payslipSchema.index(
    { employee_id: 1, month: 1 },
    { unique: true }
);

module.exports = mongoose.model('Payslip', payslipSchema);