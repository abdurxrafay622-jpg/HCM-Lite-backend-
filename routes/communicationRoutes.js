const express = require('express');

const router = express.Router();

const {
    createAnnouncement,
    getAnnouncements,
    getMyNotifications,
    markNotificationRead,
    getAuditLogs
} = require('../controllers/communicationController');

const {
    verifyJWT,
    checkRole
} = require('../middleware/authMiddleware');


// All routes require login
router.use(verifyJWT);


// Admin and HR post announcements
router.post(
    '/announcements',
    checkRole(['Admin', 'HR']),
    createAnnouncement
);


// Everyone reads announcements
router.get(
    '/announcements',
    getAnnouncements
);


// Users view their own notifications
router.get(
    '/notifications',
    getMyNotifications
);


// Mark notification as read
router.put(
    '/notifications/:id/read',
    markNotificationRead
);


// Only Admin views audit log
router.get(
    '/audit-logs',
    checkRole(['Admin']),
    getAuditLogs
);


module.exports = router;