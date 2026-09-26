const mongoose = require('mongoose');

/**
 * Connect to MongoDB Atlas (Production) or Local MongoDB (Development)
 * Uses MONGODB_URI environment variable with fail-fast validation in production.
 */
const connectDB = async () => {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DATABASE_URL;

  const isProduction = process.env.NODE_ENV === 'production';

  if (!mongoUri && isProduction) {
    console.error('[MongoDB Error] MONGODB_URI is required in production.');
    process.exit(1);
  }

  const connectionUri = mongoUri || 'mongodb://127.0.0.1:27017/nexa';

  // Attach connection lifecycle event handlers once
  if (!mongoose.connection._hasNexaListeners) {
    mongoose.connection._hasNexaListeners = true;

    mongoose.connection.on('connected', () => {
      console.log(`[MongoDB] Connected to database: ${mongoose.connection.name || 'nexa'}`);
    });

    mongoose.connection.on('error', (err) => {
      console.error(`[MongoDB Runtime Error]: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB Warning]: Database connection lost.');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('[MongoDB]: Database connection re-established.');
    });
  }

  try {
    const conn = await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 25
    });

    const isAtlas = connectionUri.includes('mongodb+srv') || connectionUri.includes('mongodb.net');
    console.log(`[MongoDB] Successfully connected to ${isAtlas ? 'MongoDB Atlas' : 'database'} host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB Error] Connection failed: ${error.message}`);
    if (isProduction) {
      console.error('[MongoDB Fatal] Production backend cannot operate without a database connection.');
      process.exit(1);
    }
    console.warn('[MongoDB Warning] Operating in development mode with pending/failed DB connection.');
  }
};

module.exports = connectDB;
