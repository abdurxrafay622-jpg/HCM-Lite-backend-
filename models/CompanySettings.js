const mongoose = require('mongoose');

const companySettingsSchema = new mongoose.Schema({
    companyName: { type: String, default: 'My Company' },
    officeStartTime: { type: String, default: '09:00' }, // HH:mm format
    graceTimeMinutes: { type: Number, default: 15 },
    halfDayUnderHours: { type: Number, default: 5 },
    officeLocation: {
        lat: { type: Number, required: true, default: 0 },
        lng: { type: Number, required: true, default: 0 },
        radiusMetres: { type: Number, default: 150 }
    }
}, { timestamps: true });

module.exports = mongoose.model('CompanySettings', companySettingsSchema);