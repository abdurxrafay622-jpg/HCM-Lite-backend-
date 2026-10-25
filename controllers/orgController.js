const CompanySettings = require('../models/CompanySettings');
const Department = require('../models/Department');

// POST /api/org/settings (Admin Only)
exports.updateSettings = async (req, res) => {
    try {
        let settings = await CompanySettings.findOne();
        if (!settings) {
            settings = new CompanySettings(req.body);
        } else {
            settings = Object.assign(settings, req.body);
        }
        await settings.save();
        res.status(200).json({ message: 'Company settings updated', settings });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// POST /api/org/departments (Admin Only)
exports.createDepartment = async (req, res) => {
    try {
        const { name } = req.body;
        const dept = await Department.create({ name });
        res.status(201).json({ message: 'Department created', dept });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};