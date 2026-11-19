import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes.js';
import collegeRoutes from './routes/college.routes.js';
import predictorRoutes from './routes/predictor.routes.js';
import studentRoutes from './routes/student.routes.js';
import adminRoutes from './routes/admin.routes.js';
import documentRoutes from './routes/document.routes.js';
import preferenceRoutes from './routes/preference.routes.js';
import allocationRoutes from './routes/allocation.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import aiRoutes from './routes/ai.routes.js';
import roundRoutes from './routes/round.routes.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';

const app = express();
const localOrigins = process.env.NODE_ENV === 'production' ? [] : [
  'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175'
];
const configuredOrigins = (process.env.CLIENT_URL || localOrigins.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...configuredOrigins, ...localOrigins])];
const isDevelopmentLoopbackOrigin = (origin) =>
  process.env.NODE_ENV !== 'production' &&
  /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isDevelopmentLoopbackOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

const mountApiRoutes = (prefix) => {
  app.get(`${prefix}/health`, (_req, res) => res.json({
    success: true,
    message: 'Rank2Campus API is healthy',
    timestamp: new Date().toISOString()
  }));
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/colleges`, collegeRoutes);
  app.use(`${prefix}/predictor`, predictorRoutes);
  app.use(`${prefix}/students`, studentRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/documents`, documentRoutes);
  app.use(`${prefix}/preferences`, preferenceRoutes);
  app.use(`${prefix}/allocations`, allocationRoutes);
  app.use(`${prefix}/notifications`, notificationRoutes);
  app.use(`${prefix}/ai`, aiRoutes);
  app.use(`${prefix}/rounds`, roundRoutes);
};

mountApiRoutes('/api/v1');
mountApiRoutes('/api');

app.use(notFound);
app.use(errorHandler);
export default app;
