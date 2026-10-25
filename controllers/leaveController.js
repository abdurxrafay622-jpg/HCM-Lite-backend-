const mongoose = require('mongoose');
const Leave = require('../models/Leave');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

const QUOTAS = {
    Annual: 14,
    Sick: 8,
    Casual: 10
};

function countWorkingDays(start, end) {
    let count = 0;
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);

    while (current <= last) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

function getEmployeeId(req) {
    const raw = req.user && req.user.employee_id;
    if (!raw) return null;
    if (mongoose.Types.ObjectId.isValid(raw)) {
        return new mongoose.Types.ObjectId(String(raw));
    }
    return null;
}

// POST /api/leave/apply
exports.applyLeave = async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        if (!employeeId) {
            return res.status(403).json({
                message: 'Only employees can apply for leave'
            });
        }

        const startDate = req.body.startDate;
        const endDate = req.body.endDate;
        const type = req.body.type;
        const reason = req.body.reason;

        if (!startDate || !endDate || !type || !reason) {
            return res.status(400).json({
                message: 'startDate, endDate, type and reason are required'
            });
        }

        if (!QUOTAS[type]) {
            return res.status(400).json({
                message: 'type must be Sick, Casual or Annual'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ message: 'Invalid dates' });
        }

        if (end < start) {
            return res.status(400).json({
                message: 'endDate cannot be before startDate'
            });
        }

        const days = countWorkingDays(start, end);
        if (days <= 0) {
            return res.status(400).json({
                message: 'Selected dates have 0 working days. Pick weekdays.'
            });
        }

        const overlap = await Leave.findOne({
            employee_id: employeeId,
            status: { $in: ['Pending', 'Approved'] },
            startDate: { $lte: end },
            endDate: { $gte: start }
        });

        if (overlap) {
            return res.status(422).json({
                message: 'Leave dates overlap with an existing request'
            });
        }

        const approvedSameType = await Leave.find({
            employee_id: employeeId,
            type: type,
            status: 'Approved'
        });

        let usedDays = 0;
        for (let i = 0; i < approvedSameType.length; i++) {
            usedDays += Number(approvedSameType[i].days) || 0;
        }

        if (usedDays + days > QUOTAS[type]) {
            return res.status(422).json({
                message: 'Over quota. ' + type + ' quota is ' + QUOTAS[type] + ', used ' + usedDays + ', requested ' + days
            });
        }

        const leave = await Leave.create({
            employee_id: employeeId,
            type: type,
            startDate: start,
            endDate: end,
            days: days,
            reason: reason,
            status: 'Pending'
        });

        return res.status(201).json({
            message: 'Leave application submitted',
            leave: leave
        });
    } catch (error) {
        console.error('APPLY LEAVE ERROR:', error);
        return res.status(500).json({ message: error.message });
    }
};

// GET /api/leave/my
exports.myLeaves = async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        if (!employeeId) {
            return res.status(403).json({
                message: 'No employee profile on this account'
            });
        }

        const leaves = await Leave.find({ employee_id: employeeId }).sort({ createdAt: -1 });

        const used = { Annual: 0, Sick: 0, Casual: 0 };
        for (let i = 0; i < leaves.length; i++) {
            const item = leaves[i];
            if (item.status === 'Approved' && used[item.type] !== undefined) {
                used[item.type] += Number(item.days) || 0;
            }
        }

        return res.status(200).json({
            balance: {
                Annual: QUOTAS.Annual - used.Annual,
                Sick: QUOTAS.Sick - used.Sick,
                Casual: QUOTAS.Casual - used.Casual
            },
            used: used,
            leaves: leaves
        });
    } catch (error) {
        console.error('MY LEAVES ERROR:', error);
        return res.status(500).json({ message: error.message });
    }
};

// GET /api/leave/pending
exports.pendingLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find({ status: 'Pending' })
            .populate('employee_id', 'name department designation')
            .sort({ createdAt: -1 });

        return res.status(200).json({ leaves: leaves });
    } catch (error) {
        console.error('PENDING LEAVES ERROR:', error);
        return res.status(500).json({ message: error.message });
    }
};

// GET /api/leave/all
exports.allLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find()
            .populate('employee_id', 'name department designation')
            .sort({ createdAt: -1 });

        return res.status(200).json({ leaves: leaves });
    } catch (error) {
        console.error('ALL LEAVES ERROR:', error);
        return res.status(500).json({ message: error.message });
    }
};

// PUT /api/leave/approve/:id
exports.approveLeave = async (req, res) => {

    try {

        const { status, hrComment } = req.body;

        if (!['Approved', 'Rejected'].includes(status)) {

            return res.status(400).json({
                message: 'Invalid status'
            });

        }

        const leave = await Leave.findById(req.params.id);

        if (!leave) {

            return res.status(404).json({
                message: 'Leave not found'
            });

        }

        if (leave.status !== 'Pending') {

            return res.status(400).json({
                message: 'Leave already processed'
            });

        }

        const before = leave.toObject();

        leave.status = status;

        leave.hrComment = hrComment || '';

        await leave.save();

        // Find employee login
        const employeeUser = await User.findOne({

            employee_id: leave.employee_id

        });

        if (employeeUser) {

            await Notification.create({

                user_id: employeeUser._id,

                title: 'Leave Request ' + status,

                message: `Your ${leave.type} leave has been ${status.toLowerCase()}.`,

                type: 'Leave'

            });

        }

        // Save audit log
        await AuditLog.create({

            actor: req.user.id,

            actorRole: req.user.role,

            action: 'LEAVE_' + status.toUpperCase(),

            entity: 'Leave',

            entityId: leave._id,

            before,

            after: leave.toObject()

        });

        res.status(200).json({

            message: 'Leave ' + status,

            leave

        });

    } catch (error) {

        console.error('LEAVE APPROVAL ERROR:', error);

        res.status(500).json({
            message: error.message
        });

    }

};
exports.cancelLeave = async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        if (!employeeId) {
            return res.status(403).json({ message: 'Only employees can cancel leave' });
        }

        const leave = await Leave.findById(req.params.id);
        if (!leave) return res.status(404).json({ message: 'Leave not found' });
        if (String(leave.employee_id) !== String(employeeId)) {
            return res.status(403).json({ message: 'Not your leave request' });
        }
        if (leave.status !== 'Pending') {
            return res.status(400).json({ message: 'Only pending leave can be cancelled' });
        }

        await leave.deleteOne();
        res.status(200).json({ message: 'Leave cancelled' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};