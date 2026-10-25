const Attendance = require('../models/Attendance');
const AttendanceCorrection = require('../models/AttendanceCorrection');
const CompanySettings = require('../models/CompanySettings');
const mongoose = require('mongoose');

function todayString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

function getEmployeeId(req) {
    const raw = req.user && req.user.employee_id;
    if (!raw) return null;
    if (mongoose.Types.ObjectId.isValid(raw)) {
        return new mongoose.Types.ObjectId(String(raw));
    }
    return null;
}

exports.checkIn = async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        if (!employeeId) {
            return res.status(403).json({ message: 'Only employees can check in' });
        }

        const dateString = todayString();
        const existing = await Attendance.findOne({ employee_id: employeeId, date: dateString });
        if (existing) {
            return res.status(400).json({ message: 'You have already checked in today' });
        }

        const settings = await CompanySettings.findOne();
        const start = (settings && settings.officeStartTime) ? settings.officeStartTime : '09:00';
        const grace = (settings && settings.graceTimeMinutes) ? settings.graceTimeMinutes : 15;

        const now = new Date();
        const [h, m] = start.split(':').map(Number);
        const lateAfter = new Date(now);
        lateAfter.setHours(h, m + grace, 0, 0);

        const status = now > lateAfter ? 'Late' : 'Present';

        const attendance = await Attendance.create({
            employee_id: employeeId,
            date: dateString,
            checkInTime: now,
            status: status
        });

        res.status(200).json({ message: 'Check-in successful. Status: ' + status, attendance });
    } catch (error) {
        console.error('CHECKIN ERROR:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.checkOut = async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        if (!employeeId) {
            return res.status(403).json({ message: 'Only employees can check out' });
        }

        const dateString = todayString();
        const record = await Attendance.findOne({ employee_id: employeeId, date: dateString });
        if (!record) return res.status(404).json({ message: 'No check-in found for today' });
        if (record.checkOutTime) return res.status(400).json({ message: 'Already checked out' });

        record.checkOutTime = new Date();

        const hours = (record.checkOutTime - record.checkInTime) / (1000 * 60 * 60);
        if (hours < 5) record.status = 'Half-day';

        await record.save();
        res.status(200).json({ message: 'Checked out successfully', record });
    } catch (error) {
        console.error('CHECKOUT ERROR:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.myAttendance = async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        if (!employeeId) {
            return res.status(403).json({ message: 'No employee profile on this account' });
        }
        const records = await Attendance.find({ employee_id: employeeId }).sort({ date: -1 }).limit(30);
        res.status(200).json({ records });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.todayBoard = async (req, res) => {
    try {
        const date = req.query.date || todayString();
        const records = await Attendance.find({ date: date })
            .populate('employee_id', 'name department designation')
            .sort({ checkInTime: 1 });
        res.status(200).json({ date, records });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.requestCorrection = async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        if (!employeeId) {
            return res.status(403).json({ message: 'Only employees can request corrections' });
        }

        const { date, requestedStatus, reason } = req.body;
        if (!date || !requestedStatus || !reason) {
            return res.status(400).json({ message: 'date, requestedStatus and reason are required' });
        }
        if (!['Present', 'Late', 'Half-day'].includes(requestedStatus)) {
            return res.status(400).json({ message: 'requestedStatus must be Present, Late or Half-day' });
        }

        const existing = await AttendanceCorrection.findOne({
            employee_id: employeeId,
            date: date,
            status: 'Pending'
        });
        if (existing) {
            return res.status(400).json({ message: 'You already have a pending correction for this date' });
        }

        const correction = await AttendanceCorrection.create({
            employee_id: employeeId,
            date: date,
            requestedStatus: requestedStatus,
            reason: reason
        });

        res.status(201).json({ message: 'Correction requested', correction });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.pendingCorrections = async (req, res) => {
    try {
        const items = await AttendanceCorrection.find({ status: 'Pending' })
            .populate('employee_id', 'name department designation')
            .sort({ createdAt: -1 });
        res.status(200).json({ corrections: items });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.decideCorrection = async (req, res) => {
    try {
        const { status, hrComment } = req.body;
        if (status !== 'Approved' && status !== 'Rejected') {
            return res.status(400).json({ message: 'status must be Approved or Rejected' });
        }

        const item = await AttendanceCorrection.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Correction not found' });
        if (item.status !== 'Pending') {
            return res.status(400).json({ message: 'Already processed' });
        }

        item.status = status;
        item.hrComment = hrComment || '';
        await item.save();

        if (status === 'Approved') {
            let record = await Attendance.findOne({
                employee_id: item.employee_id,
                date: item.date
            });
            if (record) {
                record.status = item.requestedStatus;
                await record.save();
            } else {
                await Attendance.create({
                    employee_id: item.employee_id,
                    date: item.date,
                    checkInTime: new Date(item.date + 'T09:00:00'),
                    status: item.requestedStatus
                });
            }
        }

        res.status(200).json({ message: 'Correction ' + status, correction: item });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};