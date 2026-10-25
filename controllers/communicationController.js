const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');


// ===================================
// CREATE ANNOUNCEMENT
// ===================================

exports.createAnnouncement = async (req, res) => {

    try {

        const { title, message } = req.body;

        if (!title || !message) {
            return res.status(400).json({
                message: 'Title and message are required'
            });
        }

        const announcement = await Announcement.create({

            title,

            message,

            createdBy: req.user.id,

            createdByRole: req.user.role

        });

        // Save audit log
        await AuditLog.create({

            actor: req.user.id,

            actorRole: req.user.role,

            action: 'CREATE_ANNOUNCEMENT',

            entity: 'Announcement',

            entityId: announcement._id,

            after: announcement.toObject()

        });

        res.status(201).json({

            message: 'Announcement posted successfully',

            announcement

        });

    } catch (error) {

        console.error('ANNOUNCEMENT ERROR:', error);

        res.status(500).json({
            message: error.message
        });

    }

};


// ===================================
// GET ALL ANNOUNCEMENTS
// ===================================

exports.getAnnouncements = async (req, res) => {

    try {

        const announcements = await Announcement.find()

            .populate('createdBy', 'email role')

            .sort({ createdAt: -1 });

        res.status(200).json({
            announcements
        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};


// ===================================
// GET MY NOTIFICATIONS
// ===================================

exports.getMyNotifications = async (req, res) => {

    try {

        const notifications = await Notification.find({

            user_id: req.user.id

        }).sort({ createdAt: -1 });

        const unreadCount = await Notification.countDocuments({

            user_id: req.user.id,

            isRead: false

        });

        res.status(200).json({

            unreadCount,

            notifications

        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};


// ===================================
// MARK NOTIFICATION AS READ
// ===================================

exports.markNotificationRead = async (req, res) => {

    try {

        const notification = await Notification.findOneAndUpdate(

            {
                _id: req.params.id,
                user_id: req.user.id
            },

            { isRead: true },

            { new: true }

        );

        if (!notification) {

            return res.status(404).json({
                message: 'Notification not found'
            });

        }

        res.status(200).json({

            message: 'Notification marked as read',

            notification

        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};


// ===================================
// ADMIN AUDIT LOG
// ===================================

exports.getAuditLogs = async (req, res) => {

    try {

        const logs = await AuditLog.find()

            .populate('actor', 'email role')

            .sort({ createdAt: -1 })

            .limit(100);

        res.status(200).json({
            logs
        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};