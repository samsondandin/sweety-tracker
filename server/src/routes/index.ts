import { Router } from 'express';
import authRoutes from './auth.routes.js';
import readingsRoutes from './readings.routes.js';
import reportsRoutes from './reports.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/readings', readingsRoutes);
router.use('/reports', reportsRoutes);

export default router;

