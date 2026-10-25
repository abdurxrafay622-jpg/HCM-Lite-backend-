const mongoose = require('mongoose');
const analytics = require('../services/analyticsService');

// Reads ?from=YYYY-MM-DD&to=YYYY-MM-DD&department=Engineering
function readFilters(req) {
    const from = req.query.from || analytics.monthStartString();
    const to = req.query.to || analytics.todayString();
    const department = req.query.department || '';

    if (from > to) {
        const err = new Error('from date cannot be after to date');
        err.status = 400;
        throw err;
    }

    return { from, to, department };
}

function sendError(res, error) {
    console.error('DASHBOARD ERROR:', error);
    res.status(error.status || 500).json({ message: error.message });
}

// GET /api/dashboard/departments (Admin, HR)
exports.listDepartments = async (req, res) => {
    try {
        const departments = await analytics.getDepartments();
        res.status(200).json({ departments });
    } catch (error) {
        sendError(res, error);
    }
};

// GET /api/dashboard/admin (Admin)
exports.adminDashboard = async (req, res) => {
    try {
        const filters = readFilters(req);
        const data = await analytics.getAdminKpis(filters);
        res.status(200).json({ filters, ...data });
    } catch (error) {
        sendError(res, error);
    }
};

// GET /api/dashboard/hr (HR)
exports.hrDashboard = async (req, res) => {
    try {
        const filters = readFilters(req);
        const data = await analytics.getHrKpis(filters);
        res.status(200).json({ filters, ...data });
    } catch (error) {
        sendError(res, error);
    }
};

// GET /api/dashboard/employee (Employee)
exports.employeeDashboard = async (req, res) => {
    try {
        const raw = req.user && req.user.employee_id;
        if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
            return res.status(403).json({ message: 'No employee profile on this account' });
        }
        const employeeId = new mongoose.Types.ObjectId(String(raw));
        const data = await analytics.getEmployeeKpis(employeeId);
        res.status(200).json(data);
    } catch (error) {
        sendError(res, error);
    }
};