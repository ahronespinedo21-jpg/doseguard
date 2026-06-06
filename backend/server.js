const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { sequelize } = require('./models');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const medicationRoutes = require('./routes/medicationRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // Allow mobile app requests
}));

app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Enhanced CORS configuration - Allow LAN and localhost
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests from:
    // - localhost/127.0.0.1 (any port)
    // - LAN IPs (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
    // - No origin (mobile apps, curl, postman)
    const allowedPatterns = [
      /^http:\/\/(localhost|127\.0\.0\.1):/,
      /^http:\/\/10\./,
      /^http:\/\/192\.168\./,
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[01])\./
    ];
    
    if (!origin || allowedPatterns.some(pattern => pattern.test(origin))) {
      callback(null, true);
    } else {
      callback(null, true); // Allow anyway for development
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

console.log('🔧 CORS Options:', corsOptions);
app.use(cors(corsOptions));

// CORS preflight
app.options('*', cors(corsOptions));

app.use((req, res, next) => {
  // Log requests — NEVER log body to avoid leaking passwords
  const origin = req.headers.origin || req.ip || 'unknown';
  console.log(`${new Date().toISOString()} [${req.method}] ${req.path} — origin: ${origin}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date(),
    server: 'DoseGuard Backend API'
  });
});

// Status endpoint with detailed info
app.get('/status', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'online',
    message: 'DoseGuard Backend is operational',
    server: 'DoseGuard Backend API v1.0',
    timestamp: new Date(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      user: '/api/user',
      medications: '/api/medications',
      reminders: '/api/reminders',
      admin: '/api/admin'
    }
  });
});

// Debug endpoint — DISABLED in production
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug/reminders', async (req, res) => {
    try {
      const { ReminderLog, Medication } = require('./models');
      const logs = await ReminderLog.findAll({
        include: [{ model: Medication, attributes: ['name', 'dosage'] }],
        order: [['createdAt', 'DESC']],
        limit: 20
      });
      res.json({
        success: true,
        count: logs.length,
        reminders: logs.map(l => ({
          id: l.id,
          medicationId: l.medicationId,
          medicationName: l.Medication?.name,
          scheduledTime: l.scheduledTime,
          status: l.status,
          date: l.date,
          createdAt: l.createdAt
        }))
      });
    } catch (error) {
      // Do not leak error.message in response
      console.error('Debug endpoint error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch debug data' });
    }
  });
}

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: { success: false, message: 'Too many API requests, please try again later.' }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', apiLimiter, userRoutes);
app.use('/api/medications', apiLimiter, medicationRoutes);
app.use('/api/reminders', apiLimiter, reminderRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);

app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'DoseGuard API v1.0',
    description: 'A Daily Dose Reminder Backend API'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const DEFAULT_PORT = parseInt(process.env.PORT || 3001, 10);
const HOST = '0.0.0.0'; // Bind to all network interfaces
const PID_FILE = path.join(__dirname, 'backend.pid');

// Function to get local IP
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

// Manage Single Instance
function enforceSingleInstance() {
  if (fs.existsSync(PID_FILE)) {
    try {
      const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf-8'), 10);
      if (oldPid && oldPid !== process.pid) {
        console.log(`🔄 Found previous instance running (PID: ${oldPid}). Attempting to stop it...`);
        try {
          process.kill(oldPid, 'SIGTERM'); // Try graceful shutdown first
          console.log(`✅ Sent SIGTERM to PID ${oldPid}`);
        } catch (e) {
          // Process might already be dead
          if (e.code !== 'ESRCH') {
            console.warn(`⚠️ Failed to kill old process:`, e.message);
          }
        }
      }
    } catch (e) {
      console.warn(`⚠️ Failed to read or kill old PID:`, e.message);
    }
  }
  // Write current PID
  fs.writeFileSync(PID_FILE, process.pid.toString());
}

// Dynamically Update Frontend API Config
function updateFrontendConfig(newPort) {
  const configPath = path.resolve(__dirname, '../src/app/services/api-config.service.ts');
  if (fs.existsSync(configPath)) {
    try {
      let content = fs.readFileSync(configPath, 'utf-8');
      const updatedContent = content.replace(
        /private readonly PORT\s*=\s*['"]\d+['"];/,
        `private readonly PORT        = '${newPort}';`
      );
      
      if (content !== updatedContent) {
        fs.writeFileSync(configPath, updatedContent);
        console.log(`🔄 Automatically updated frontend API config to use port ${newPort}`);
      }
    } catch (e) {
      console.warn(`⚠️ Failed to update frontend config:`, e.message);
    }
  }
}

let currentServer = null;

async function startServerWithFallback(port) {
  try {
    await sequelize.sync();
    
    const server = app.listen(port, HOST);
    currentServer = server;

    server.on('listening', () => {
      console.log('✅ Database synchronized successfully!');
      console.log(`\n🚀 DoseGuard API Server is RUNNING`);
      console.log(`\n📡 CONNECTION DETAILS:`);
      console.log(`   Localhost:  http://localhost:${port}`);
      console.log(`   LAN IP:     http://${localIP}:${port}`);
      console.log(`   All IPs:    http://0.0.0.0:${port}`);
      console.log(`\n🔗 IMPORTANT: Use http://${localIP}:${port} on mobile devices`);
      console.log(`\n📚 API Routes:`);
      console.log(`   Health Check:     http://${localIP}:${port}/health`);
      console.log(`   Status:           http://${localIP}:${port}/status`);
      console.log(`   API Base:         http://${localIP}:${port}/api`);
      console.log(`   Auth:             http://${localIP}:${port}/api/auth`);
      console.log(`   Medications:      http://${localIP}:${port}/api/medications`);
      console.log(`   Reminders:        http://${localIP}:${port}/api/reminders\n`);

      updateFrontendConfig(port);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${port} is currently in use.`);
        const nextPort = port + 1;
        console.log(`🔄 Falling back to alternative port: ${nextPort}...`);
        startServerWithFallback(nextPort);
      } else {
        console.error('❌ Server startup error:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start sequence
enforceSingleInstance();
startServerWithFallback(DEFAULT_PORT);

// Graceful Shutdown Handlers
function gracefulShutdown() {
  console.log('\n🛑 Received shutdown signal, closing server gracefully...');
  if (currentServer) {
    currentServer.close(() => {
      console.log('✅ Server closed.');
      sequelize.close().then(() => {
        console.log('✅ Database connection closed.');
        if (fs.existsSync(PID_FILE)) {
          fs.unlinkSync(PID_FILE);
        }
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  // Do not exit immediately on unhandled promise rejections
});
