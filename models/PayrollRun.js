const mongoose = require('mongoose');

const payrollRunSchema = new mongoose.Schema({

    month: {
        type: String,
        required: true,
        unique: true
    },

    status: {
        type: String,
        enum: ['Draft', 'Finalized'],
        default: 'Draft'
    },

    totalEmployees: {
        type: Number,
        default: 0
    },

    totalGross: {
        type: Number,
        default: 0
    },

    totalDeductions: {
        type: Number,
        default: 0
    },

    totalNet: {
        type: Number,
        default: 0
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    finalizedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    finalizedAt: {
        type: Date,
        default: null
    }

}, { timestamps: true });

module.exports = mongoose.model('PayrollRun', payrollRunSchema);