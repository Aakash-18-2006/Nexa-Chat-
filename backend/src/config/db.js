const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DATABASE_URL ||
    'mongodb://127.0.0.1:27017/nexa';

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[MongoDB Error] Connection failed: ${error.message}`);
    // In production container environments, don't exit immediately to allow automatic retries if DB is starting
    if (process.env.NODE_ENV === 'development') {
      console.warn('[MongoDB] Running without persistent DB or check MongoDB service.');
    }
  }
};

module.exports = connectDB;

