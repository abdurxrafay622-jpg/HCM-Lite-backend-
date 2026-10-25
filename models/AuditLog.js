const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({

    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    actorRole: {
        type: String,
        required: true
    },

    action: {
        type: String,
        required: true
    },

    entity: {
        type: String,
        required: true
    },

    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },

    before: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    after: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }

}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);