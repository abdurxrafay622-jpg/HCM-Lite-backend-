const express = require('express');
const cors = require('cors');
const dns = require('dns'); // 1. IMPORT DNS
require('dotenv').config();

// 2. FORCE GOOGLE/CLOUDFLARE DNS TO FIX MONGODB ATLAS ERROR
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const communicationRoutes = require('./routes/communicationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const orgRoutes = require('./routes/orgRoutes');
const connectDB = require('./config/db');
const setupFirstAdmin = require('./utils/firstRunSetup');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// 3. APPLY YOUR MIDDLEWARE
app.use('/api/org', orgRoutes);
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allows large JSON payloads for later
app.use('/api/users', userRoutes);

// Connect to Database & Run First Setup
connectDB().then(() => {
    setupFirstAdmin();
});

// Routes
app.use('/api/comms', communicationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/auth', authRoutes);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});