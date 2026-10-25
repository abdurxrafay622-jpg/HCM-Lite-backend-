const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({

    title: {
        type: String,
        required: true,
        trim: true
    },

    message: {
        type: String,
        required: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    createdByRole: {
        type: String,
        enum: ['Admin', 'HR'],
        required: true
    }

}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);