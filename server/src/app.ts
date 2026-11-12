import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Timezone']
    })
  );

  app.use(cookieParser());
  app.use(express.json());

  // Mount API routes
  app.use('/api', apiRoutes);

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

