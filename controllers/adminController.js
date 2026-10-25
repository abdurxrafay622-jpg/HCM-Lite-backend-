
const Attendance = require('../models/Attendance');
const AttendanceCorrection = require('../models/AttendanceCorrection');
const CompanySettings = require('../models/CompanySettings');
const User = require('../models/User');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

function todayString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getEmployeeId(req) {
    const raw = req.user && req.user.employee_id;
    if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
    return new mongoose.Types.ObjectId(String(raw));
}

// Create an HR account (Admin only; protect this route with middleware)
exports.createHR = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: 'Name, email and password are required'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters long'
            });
        }

        const existingUser = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (existingUser) {
            return res.status(409).json({
                message: 'A user with this email already exists'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const hr = await User.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password: hashedPassword,
            role: 'HR'
        });

        return res.status(201).json({
            message: 'HR account created successfully',
            user: {
                id: hr._id,
                name: hr.name,
                email: hr.email,
                role: hr.role
            }
        });
    } catch (error) {
        console.error('CREATE HR ERROR:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: 'A user with this email already exists'
            });
        }

        return res.status(500).json({
            message: 'Failed to create HR account'
        });
    }
};

exports.checkIn = async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        if (!employeeId) {
            return res.status(403).json({
                message: 'Only employees can check in'
            });
        }

        const dateString = todayString();
        const existing = await Attendance.findOne({
            employee_id: employeeId,
            date: dateString
        });

        if (existing) {
            return res.status(400).json({
                message: 'You have already checked in today'
            });
        }

        const settings = await CompanySettings.findOne();
        const start = settings?.officeStartTime || '09:00';
        const grace = settings?.graceTimeMinutes ?? 15;

        const now = new Date();
        const [h, m] = start.split(':').map(Number);
        const lateAfter = new Date(now);
        lateAfter.setHours(h, m + grace, 0, 0);

        const status = now > lateAfter ? 'Late' : 'Present';

        const attendance = await Attendance.create({
            employee_id: employeeId,
            date: dateString,
            checkInTime: now,
            status
        });

        return res.status(200).json({
            message: `Check-in successful. Status: ${status}`,
            attendance
        });
    } catch (error) {
        console.error('CHECKIN ERROR:', error);
        return res.status(500).json({ message: error.message });
    }
};

exports.checkOut = async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        if (!employeeId) {
            return res.status(403).json({
                message: 'Only employees can check out'
            });
        }

        const record = await Attendance.findOne({
            employee_id: employeeId,
            date: todayString()
        });

        if (!record) {
            return res.status(404).json({
                message: 'No check-in found for today'
            });
        }

        if (record.checkOutTime) {
            return res.status(400).json({
                message: 'Already checked out'
            });
        }

        record.checkOutTime = new Date();

        const hours =
            (record.checkOutTime - record.checkInTime) /
            (1000 * 60 * 60);

        if (hours < 5) record.status = 'Half-day';

        await record.save();

        return res.status(200).json({
            message: 'Checked out successfully',
            record
        });
    } catch (error) {
        console.error('CHECKOUT ERROR:', error);
        return res.status(500).json({ message: error.message });
    }
};

exports.myAttendance = async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);

        if (!employeeId) {
            return res.status(403).json({
                message: 'No employee profile on this account'
            });
        }

        const records = await Attendance.find({
            employee_id: employeeId
        }).sort({ date: -1 }).limit(30);

        return res.status(200).json({ records });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

exports.todayBoard = async (req, res) => {
    try {
        const date = req.query.date || todayString();

        const records = await Attendance.find({ date })
            .populate('employee_id', 'name department designation')
            .sort({ checkInTime: 1 });

        return res.status(200).json({ date, records });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

exports.requestCorrection = async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);

        if (!employeeId) {
            return res.status(403).json({
                message: 'Only employees can request corrections'
            });
        }

        const { date, requestedStatus, reason } = req.body;

        if (!date || !requestedStatus || !reason) {
            return res.status(400).json({
                message: 'date, requestedStatus and reason are required'
            });
        }

        if (!['Present', 'Late', 'Half-day'].includes(requestedStatus)) {
            return res.status(400).json({
                message: 'Invalid requestedStatus'
            });
        }

        const existing = await AttendanceCorrection.findOne({
            employee_id: employeeId,
            date,
            status: 'Pending'
        });

        if (existing) {
            return res.status(400).json({
                message: 'You already have a pending correction for this date'
            });
        }

        const correction = await AttendanceCorrection.create({
            employee_id: employeeId,
            date,
            requestedStatus,
            reason
        });

        return res.status(201).json({
            message: 'Correction requested',
            correction
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

exports.pendingCorrections = async (req, res) => {
    try {
        const items = await AttendanceCorrection.find({
            status: 'Pending'
        })
            .populate('employee_id', 'name department designation')
            .sort({ createdAt: -1 });

        return res.status(200).json({ corrections: items });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

exports.decideCorrection = async (req, res) => {
    try {
        const { status, hrComment } = req.body;

        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({
                message: 'status must be Approved or Rejected'
            });
        }

        const item = await AttendanceCorrection.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                message: 'Correction not found'
            });
        }

        if (item.status !== 'Pending') {
            return res.status(400).json({
                message: 'Already processed'
            });
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
                    checkInTime: new Date(`${item.date}T09:00:00`),
                    status: item.requestedStatus
                });
            }
        }

        return res.status(200).json({
            message: `Correction ${status}`,
            correction: item
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
