const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = require('./config/db');
const initSocketHandlers = require('./sockets/socketHandlers');

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const groupRoutes = require('./routes/groupRoutes');
const tempRoomRoutes = require('./routes/tempRoomRoutes');
const aiRoutes = require('./routes/aiRoutes');
const searchRoutes = require('./routes/searchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const followRoutes = require('./routes/followRoutes');
const callRoutes = require('./routes/callRoutes');
const accountRoutes = require('./routes/accountRoutes');

// Initialize database
connectDB();

// Initialize and verify SMTP configuration on startup
const emailService = require('./services/emailService');
emailService.verifyOnStartup();

const app = express();
const server = http.createServer(app);

// Configure dynamic CORS for development and production
const configuredUrls = [
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : []),
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : [])
].map((url) => url.trim().replace(/\/$/, '')).filter(Boolean);

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const allowedOrigins = configuredUrls.length > 0
  ? Array.from(new Set([...configuredUrls, ...defaultOrigins]))
  : defaultOrigins;

const corsOriginCheck = (origin, callback) => {
  // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
  if (!origin) return callback(null, true);
  if (
    allowedOrigins.includes(origin) ||
    allowedOrigins.includes('*') ||
    origin.endsWith('.vercel.app') ||
    origin.endsWith('.onrender.com') ||
    origin.endsWith('.netlify.app') ||
    origin.endsWith('.railway.app') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  ) {
    return callback(null, true);
  }
  return callback(new Error(`Origin ${origin} not permitted by CORS policy`), false);
};

const io = new Server(server, {
  cors: {
    origin: corsOriginCheck,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Pass IO instance to socket handlers and attach to app
initSocketHandlers(io);
app.set('io', io);

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

app.use(
  cors({
    origin: corsOriginCheck,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  })
);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Performance Timing Middleware
// Logs slow API requests without modifying headers after the response is sent.
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    if (duration > 200) {
      console.log(
        `[API Latency Warning] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`
      );
    }
  });

  next();
});

app.use(morgan('dev'));

// Static uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limit authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 min
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});
app.use('/api/auth', authLimiter);

// Health check endpoints with database status verification
const handleHealthCheck = (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const dbStatus = isDbConnected
    ? 'connected'
    : mongoose.connection.readyState === 2
    ? 'connecting'
    : 'disconnected';

  res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? 'ok' : 'degraded',
    database: dbStatus,
    appName: 'NEXA Real-time Chat',
    version: '1.0.0',
    timestamp: new Date()
  });
};

app.get('/api/health', handleHealthCheck);
app.get('/health', handleHealthCheck);
app.get('/api/health/smtp', async (req, res) => {
  const status = await emailService.verifyConnection();
  res.status(status.verified ? 200 : 503).json({
    status: status.verified ? 'ok' : 'pending_configuration',
    configured: status.configured,
    verified: status.verified,
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || 'akasuran6@gmail.com',
    from: process.env.EMAIL_FROM || '"NEXA Security" <akasuran6@gmail.com>',
    error: status.error || null
  });
});
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'NEXA Backend API is running',
    version: '1.0.0'
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/temp-rooms', tempRoomRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/uploads', mediaRoutes);
app.use('/api/calls', callRoutes);

// Global 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API route not found: ${req.originalUrl}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error occurred'
  });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Server startup binding to 0.0.0.0 for cloud deployment compatibility
server.listen(PORT, HOST, () => {
  console.log(`[NEXA Server] Running on http://${HOST}:${PORT}`);
});

