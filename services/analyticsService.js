const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Payslip = require('../models/Payslip');
const AttendanceCorrection = require('../models/AttendanceCorrection');

const QUOTAS = { Annual: 14, Sick: 8, Casual: 10 };
const WEEKLY_TARGET_HOURS = 40;

// ---------- DATE HELPERS ----------

function pad(n) {
    return String(n).padStart(2, '0');
}

function dateToString(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function todayString() {
    return dateToString(new Date());
}

function monthStartString() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-01';
}

function mondayOfThisWeekString() {
    const d = new Date();
    const diff = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - diff);
    return dateToString(d);
}

function parseDateStr(str) {
    const parts = str.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function endOfDay(str) {
    const d = parseDateStr(str);
    d.setHours(23, 59, 59, 999);
    return d;
}

function countWorkingDays(fromStr, toStr) {
    const cur = parseDateStr(fromStr);
    const last = parseDateStr(toStr);
    let count = 0;
    while (cur <= last) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) count++;
        cur.setDate(cur.getDate() + 1);
    }
    return count;
}

function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

// ---------- PIPELINE HELPERS ----------

// Employee filter used for headcount
function employeeFilter(department) {
    const match = { status: { $ne: 'Exited' } };
    if (department) match.department = department;
    return match;
}

// Joins the employee document onto attendance/leave/payslip rows
// so we can filter and group by department and name.
function joinEmployee(department) {
    const stages = [
        {
            $lookup: {
                from: 'employees',
                localField: 'employee_id',
                foreignField: '_id',
                as: 'emp'
            }
        },
        { $unwind: '$emp' },
        { $match: { 'emp.status': { $ne: 'Exited' } } }
    ];
    if (department) {
        stages.push({ $match: { 'emp.department': department } });
    }
    return stages;
}

// ---------- SHARED ----------

async function getDepartments() {
    const list = await Employee.distinct('department', { status: { $ne: 'Exited' } });
    return list.sort();
}

// ---------- ADMIN DASHBOARD ----------

async function getAdminKpis({ from, to, department }) {
    // Headcount and average salary per department
    const deptStats = await Employee.aggregate([
        { $match: employeeFilter(department) },
        {
            $group: {
                _id: '$department',
                headcount: { $sum: 1 },
                avgBasic: { $avg: '$salaryBasic' },
                avgGross: { $avg: { $multiply: ['$salaryBasic', 1.5] } }
            }
        },
        { $sort: { headcount: -1 } }
    ]);

    const headcount = deptStats.reduce((sum, d) => sum + d.headcount, 0);
    const avgGross = headcount
        ? round2(deptStats.reduce((sum, d) => sum + d.avgGross * d.headcount, 0) / headcount)
        : 0;

    // Exits in the selected period
    const exitMatch = {
        status: 'Exited',
        exitDate: { $gte: parseDateStr(from), $lte: endOfDay(to) }
    };
    if (department) exitMatch.department = department;
    const exitsInPeriod = await Employee.countDocuments(exitMatch);

    // Attrition = exits / average headcount x 100
    // Start headcount is approximated as current + exits.
    const avgHeadcount = headcount + exitsInPeriod / 2;
    const attritionPct = avgHeadcount ? round2((exitsInPeriod / avgHeadcount) * 100) : 0;

    // Average tenure in years
    const tenureRows = await Employee.aggregate([
        { $match: employeeFilter(department) },
        {
            $project: {
                years: {
                    $divide: [
                        { $subtract: [new Date(), '$joiningDate'] },
                        1000 * 60 * 60 * 24 * 365
                    ]
                }
            }
        },
        { $group: { _id: null, avgYears: { $avg: '$years' } } }
    ]);
    const avgTenureYears = tenureRows[0] ? round2(tenureRows[0].avgYears) : 0;

    // Payroll cost: only FINALIZED payroll runs count
    const payrollByDept = await Payslip.aggregate([
        { $match: { month: { $gte: from.slice(0, 7), $lte: to.slice(0, 7) } } },
        {
            $lookup: {
                from: 'payrollruns',
                localField: 'payrollRun',
                foreignField: '_id',
                as: 'run'
            }
        },
        { $unwind: '$run' },
        { $match: { 'run.status': 'Finalized' } },
        ...joinEmployee(department),
        {
            $group: {
                _id: '$emp.department',
                gross: { $sum: '$grossSalary' },
                net: { $sum: '$netSalary' },
                payslips: { $sum: 1 }
            }
        },
        { $sort: { gross: -1 } }
    ]);

    const payrollGross = payrollByDept.reduce((s, p) => s + p.gross, 0);
    const payrollNet = payrollByDept.reduce((s, p) => s + p.net, 0);

    return {
        headcount,
        exitsInPeriod,
        attritionPct,
        avgGross,
        avgTenureYears,
        payrollGross: round2(payrollGross),
        payrollNet: round2(payrollNet),
        headcountByDept: deptStats.map(d => ({
            department: d._id || 'Unassigned',
            headcount: d.headcount,
            avgBasic: round2(d.avgBasic)
        })),
        payrollByDept: payrollByDept.map(p => ({
            department: p._id || 'Unassigned',
            gross: round2(p.gross),
            net: round2(p.net),
            payslips: p.payslips
        }))
    };
}

// ---------- HR DASHBOARD ----------

async function getHrKpis({ from, to, department }) {
    const today = todayString();
    const workingDays = countWorkingDays(from, to);

    const headcount = await Employee.countDocuments(employeeFilter(department));

    // Today's attendance by status
    const todayRows = await Attendance.aggregate([
        { $match: { date: today } },
        ...joinEmployee(department),
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const countStatus = (s) => {
        const row = todayRows.find(r => r._id === s);
        return row ? row.count : 0;
    };
    const presentToday = countStatus('Present') + countStatus('Late') + countStatus('Half-day');
    const lateToday = countStatus('Late');

    // On leave today (approved leave overlapping today)
    const onLeaveTodayRows = await Leave.aggregate([
        {
            $match: {
                status: 'Approved',
                startDate: { $lte: endOfDay(today) },
                endDate: { $gte: parseDateStr(today) }
            }
        },
        ...joinEmployee(department)
    ]);
    const onLeaveToday = onLeaveTodayRows.length;

    // Pending approvals (not date-limited)
    const pendingLeaves = (await Leave.aggregate([
        { $match: { status: 'Pending' } },
        ...joinEmployee(department)
    ])).length;

    const pendingCorrections = (await AttendanceCorrection.aggregate([
        { $match: { status: 'Pending' } },
        ...joinEmployee(department)
    ])).length;

    // Attendance trend by day (date range)
    const trend = await Attendance.aggregate([
        { $match: { date: { $gte: from, $lte: to } } },
        ...joinEmployee(department),
        {
            $group: {
                _id: '$date',
                records: { $sum: 1 },
                late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Attendance counts per department (date range)
    const deptAttendance = await Attendance.aggregate([
        { $match: { date: { $gte: from, $lte: to } } },
        ...joinEmployee(department),
        {
            $group: {
                _id: '$emp.department',
                records: { $sum: 1 },
                late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } }
            }
        }
    ]);

    // Approved leave days per department (date range)
    const deptLeaves = await Leave.aggregate([
        {
            $match: {
                status: 'Approved',
                startDate: { $lte: endOfDay(to) },
                endDate: { $gte: parseDateStr(from) }
            }
        },
        ...joinEmployee(department),
        { $group: { _id: '$emp.department', leaveDays: { $sum: '$days' } } }
    ]);

    // Headcount per department
    const empByDept = await Employee.aggregate([
        { $match: employeeFilter(department) },
        { $group: { _id: '$department', headcount: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    // Combine: absenteeism = expected days - leave days - attended records
    const byDepartment = empByDept.map(d => {
        const att = deptAttendance.find(a => a._id === d._id) || { records: 0, late: 0 };
        const lv = deptLeaves.find(l => l._id === d._id) || { leaveDays: 0 };
        const expected = d.headcount * workingDays;
        const absentDays = Math.max(0, expected - lv.leaveDays - att.records);

        return {
            department: d._id || 'Unassigned',
            headcount: d.headcount,
            absentDays,
            absenteeismPct: expected ? round2((absentDays / expected) * 100) : 0,
            latePct: att.records ? round2((att.late / att.records) * 100) : 0,
            leaveDays: lv.leaveDays
        };
    });

    // Leave by type (approved, date range)
    const leaveByType = await Leave.aggregate([
        {
            $match: {
                status: 'Approved',
                startDate: { $lte: endOfDay(to) },
                endDate: { $gte: parseDateStr(from) }
            }
        },
        ...joinEmployee(department),
        {
            $group: {
                _id: '$type',
                days: { $sum: '$days' },
                requests: { $sum: 1 }
            }
        }
    ]);

    // Top 5 late-comers (date range)
    const topLate = await Attendance.aggregate([
        { $match: { date: { $gte: from, $lte: to }, status: 'Late' } },
        ...joinEmployee(department),
        {
            $group: {
                _id: '$emp._id',
                name: { $first: '$emp.name' },
                department: { $first: '$emp.department' },
                lateCount: { $sum: 1 }
            }
        },
        { $sort: { lateCount: -1 } },
        { $limit: 5 }
    ]);

    return {
        today,
        headcount,
        presentToday,
        lateToday,
        onLeaveToday,
        pendingLeaves,
        pendingCorrections,
        trend: trend.map(t => ({ date: t._id, records: t.records, late: t.late })),
        byDepartment,
        leaveByType: leaveByType.map(l => ({ type: l._id, days: l.days, requests: l.requests })),
        topLate: topLate.map(t => ({ name: t.name, department: t.department, lateCount: t.lateCount }))
    };
}

// ---------- EMPLOYEE DASHBOARD ----------

async function getEmployeeKpis(employeeId) {
    const today = todayString();
    const monthStart = monthStartString();
    const weekStart = mondayOfThisWeekString();

    // Today's check-in state
    const todayRecord = await Attendance.findOne({ employee_id: employeeId, date: today });

    // Hours this week
    const weekRecords = await Attendance.find({
        employee_id: employeeId,
        date: { $gte: weekStart, $lte: today }
    });
    let hoursThisWeek = 0;
    weekRecords.forEach(r => {
        if (r.checkInTime && r.checkOutTime) {
            hoursThisWeek += (new Date(r.checkOutTime) - new Date(r.checkInTime)) / 3600000;
        }
    });

    // Late count this month
    const lateCountThisMonth = await Attendance.countDocuments({
        employee_id: employeeId,
        status: 'Late',
        date: { $gte: monthStart, $lte: today }
    });

    // Leave balance (approved only, matches the leave module)
    const approvedLeaves = await Leave.find({ employee_id: employeeId, status: 'Approved' });
    const used = { Annual: 0, Sick: 0, Casual: 0 };
    approvedLeaves.forEach(l => {
        if (used[l.type] !== undefined) used[l.type] += Number(l.days) || 0;
    });
    const leaveBalance = {
        Annual: QUOTAS.Annual - used.Annual,
        Sick: QUOTAS.Sick - used.Sick,
        Casual: QUOTAS.Casual - used.Casual
    };

    // Last payslip
    const lastPayslip = await Payslip.findOne({ employee_id: employeeId }).sort({ month: -1 });

    return {
        today: {
            date: today,
            checkedIn: !!todayRecord,
            checkedOut: !!(todayRecord && todayRecord.checkOutTime),
            status: todayRecord ? todayRecord.status : null
        },
        hoursThisWeek: round2(hoursThisWeek),
        weeklyTargetHours: WEEKLY_TARGET_HOURS,
        lateCountThisMonth,
        leaveBalance,
        lastPayslip: lastPayslip
            ? {
                month: lastPayslip.month,
                grossSalary: lastPayslip.grossSalary,
                netSalary: lastPayslip.netSalary
            }
            : null
    };
}

module.exports = {
    todayString,
    monthStartString,
    getDepartments,
    getAdminKpis,
    getHrKpis,
    getEmployeeKpis
};