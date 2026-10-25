const mongoose = require('mongoose');

const PayrollRun = require('../models/PayrollRun');
const Payslip = require('../models/Payslip');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');


// =====================================
// TAX CALCULATION
// =====================================

function calculateTax(monthlyGross) {

    const annualSalary = monthlyGross * 12;

    let annualTax = 0;

    if (annualSalary <= 600000) {

        annualTax = 0;

    } else if (annualSalary <= 1200000) {

        annualTax = (annualSalary - 600000) * 0.05;

    } else if (annualSalary <= 2400000) {

        annualTax = 30000 +
            (annualSalary - 1200000) * 0.15;

    } else if (annualSalary <= 3600000) {

        annualTax = 210000 +
            (annualSalary - 2400000) * 0.25;

    } else {

        annualTax = 510000 +
            (annualSalary - 3600000) * 0.35;

    }

    return annualTax / 12;
}


// =====================================
// COUNT WORKING DAYS
// =====================================

function getWorkingDays(year, month) {

    let days = 0;

    const totalDays = new Date(year, month, 0).getDate();

    for (let day = 1; day <= totalDays; day++) {

        const date = new Date(year, month - 1, day);

        const weekDay = date.getDay();

        if (weekDay !== 0 && weekDay !== 6) {
            days++;
        }

    }

    return days;
}


// =====================================
// GENERATE MONTHLY PAYROLL (HR)
// =====================================

exports.generatePayroll = async (req, res) => {

    try {

        const { month } = req.body;

        if (!month) {
            return res.status(400).json({
                message: 'Month is required. Example: 2026-10'
            });
        }

        // Prevent duplicate payroll
        const existing = await PayrollRun.findOne({ month });

        if (existing) {
            return res.status(400).json({
                message: 'Payroll already exists for this month'
            });
        }

        const employees = await Employee.find();

        if (employees.length === 0) {
            return res.status(400).json({
                message: 'No employees found'
            });
        }

        const [year, monthNumber] = month.split('-').map(Number);

        const workingDays = getWorkingDays(year, monthNumber);

        const payroll = await PayrollRun.create({
            month,
            createdBy: req.user.id
        });

        let totalGross = 0;
        let totalDeductions = 0;
        let totalNet = 0;

        for (const employee of employees) {

            const basic = employee.salaryBasic;

            const hra = basic * 0.40;

            const medical = basic * 0.10;

            const gross = basic + hra + medical;

            const attendanceRecords = await Attendance.find({

                employee_id: employee._id,

                date: {
                    $regex: '^' + month
                }

            });

            let halfDays = 0;

            for (const record of attendanceRecords) {

                if (record.status === 'Half-day') {
                    halfDays++;
                }

            }

            const approvedLeaves = await Leave.find({

                employee_id: employee._id,

                status: 'Approved',

                startDate: {
                    $lte: new Date(year, monthNumber, 0)
                },

                endDate: {
                    $gte: new Date(year, monthNumber - 1, 1)
                }

            });

            let unpaidLeaveDays = 0;

            // Currently unpaid leave isn't implemented,
            // so deduction remains zero.

            // Count missing attendance days
            const presentDays = attendanceRecords.length;

            const absentDays = Math.max(
                0,
                workingDays - presentDays
            );

            const dailySalary = gross / workingDays;

            const attendanceDeduction =
                (absentDays * dailySalary) +
                (halfDays * 0.5 * dailySalary) +
                (unpaidLeaveDays * dailySalary);

            const tax = calculateTax(gross);

            const totalDeduction =
                attendanceDeduction + tax;

            const netSalary = Math.max(
                0,
                gross - totalDeduction
            );

            await Payslip.create({

                payrollRun: payroll._id,

                employee_id: employee._id,

                month,

                basicSalary: basic,

                hra,

                medicalAllowance: medical,

                grossSalary: gross,

                absentDays,

                halfDays,

                unpaidLeaveDays,

                attendanceDeduction,

                tax,

                totalDeductions: totalDeduction,

                netSalary

            });

            totalGross += gross;

            totalDeductions += totalDeduction;

            totalNet += netSalary;

        }

        payroll.totalEmployees = employees.length;

        payroll.totalGross = totalGross;

        payroll.totalDeductions = totalDeductions;

        payroll.totalNet = totalNet;

        await payroll.save();

        res.status(201).json({

            message: 'Payroll draft generated successfully',

            payroll

        });

    } catch (error) {

        console.error('PAYROLL ERROR:', error);

        res.status(500).json({
            message: error.message
        });

    }

};


// =====================================
// GET ALL PAYROLL RUNS
// =====================================

exports.getPayrollRuns = async (req, res) => {

    try {

        const payrolls = await PayrollRun.find()
            .sort({ createdAt: -1 });

        res.status(200).json({ payrolls });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};


// =====================================
// FINALIZE PAYROLL (ADMIN)
// =====================================

exports.finalizePayroll = async (req, res) => {

    try {

        const payroll = await PayrollRun.findById(req.params.id);

        if (!payroll) {

            return res.status(404).json({
                message: 'Payroll not found'
            });

        }

        if (payroll.status === 'Finalized') {

            return res.status(400).json({
                message: 'Payroll already finalized'
            });

        }

        const before = payroll.toObject();

        payroll.status = 'Finalized';

        payroll.finalizedBy = req.user.id;

        payroll.finalizedAt = new Date();

        await payroll.save();

        // Find employees included in this payroll
        const payslips = await Payslip.find({
            payrollRun: payroll._id
        });

        for (const payslip of payslips) {

            const employeeUser = await User.findOne({
                employee_id: payslip.employee_id
            });

            if (employeeUser) {

                await Notification.create({

                    user_id: employeeUser._id,

                    title: 'Payslip Available',

                    message: `Your payslip for ${payroll.month} is available.`,

                    type: 'Payroll'

                });

            }

        }

        // Audit log
        await AuditLog.create({

            actor: req.user.id,

            actorRole: req.user.role,

            action: 'FINALIZE_PAYROLL',

            entity: 'PayrollRun',

            entityId: payroll._id,

            before,

            after: payroll.toObject()

        });

        res.status(200).json({

            message: 'Payroll finalized successfully',

            payroll

        });

    } catch (error) {

        console.error('FINALIZE PAYROLL ERROR:', error);

        res.status(500).json({
            message: error.message
        });

    }

};
// EMPLOYEE MY PAYSLIPS
// =====================================

exports.myPayslips = async (req, res) => {

    try {

        const employeeId = req.user.employee_id;

        const payslips = await Payslip.find({
            employee_id: employeeId
        }).sort({ month: -1 });

        res.status(200).json({ payslips });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};


// =====================================
// GET PAYSLIPS FOR A MONTH (HR / ADMIN)
// =====================================

exports.getMonthlyPayslips = async (req, res) => {

    try {

        const payslips = await Payslip.find({
            month: req.params.month
        }).populate('employee_id', 'name department designation');

        res.status(200).json({ payslips });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};