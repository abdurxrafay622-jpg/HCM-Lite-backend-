const mongoose = require('mongoose');

const attendanceCorrectionSchema = new mongoose.Schema({
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    date: { type: String, required: true },
    requestedStatus: {
        type: String,
        enum: ['Present', 'Late', 'Half-day'],
        required: true
    },
    reason: { type: String, required: true },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    hrComment: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('AttendanceCorrection', attendanceCorrectionSchema);