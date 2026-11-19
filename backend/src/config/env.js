/**
 * env.js
 * ------
 * Reads every environment variable the app uses, in ONE place.
 * Other files import `config` from here instead of reading process.env
 * directly, so we can see all settings at a glance.
 *
 * Values come from the .env file (local dev) or real environment
 * variables (Docker / AWS). See .env.example for the full list.
 */
require('dotenv').config({ quiet: true });

const isTest = process.env.NODE_ENV === 'test';

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,

  // PostgreSQL connection string, e.g. postgres://user:pass@localhost:5432/fleet360
  databaseUrl: isTest
    ? process.env.TEST_DATABASE_URL || 'postgres://fleet:fleet@localhost:5432/fleet360_test'
    : process.env.DATABASE_URL || 'postgres://fleet:fleet@localhost:5432/fleet360',

  // Redis is optional in development. If REDIS_URL is empty, an in-memory
  // fallback is used (see config/redis.js).
  redisUrl: process.env.REDIS_URL || '',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h', // how long a login stays valid
  },

  // Allowed frontend origin(s) for CORS, comma separated.
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),

  // Login protection: lock the account after N wrong passwords for M minutes.
  security: {
    maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockMinutes: Number(process.env.LOCK_MINUTES) || 15,
  },

  // File storage. If S3_BUCKET is empty, files are saved on local disk
  // in backend/uploads and served at /uploads/... (fine for development).
  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.AWS_REGION || 'ap-south-1',
    endpoint: process.env.S3_ENDPOINT || '', // set for MinIO (local S3), leave empty for real AWS
    publicUrl: process.env.S3_PUBLIC_URL || '', // base URL used to show the file in the browser
  },
};

// Safety check: never run production with the default secret.
if (config.env === 'production' && config.jwt.secret === 'dev-only-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = config;
