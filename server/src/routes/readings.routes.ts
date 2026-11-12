import { Router } from 'express';
import { ReadingsController } from '../controllers/readings.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', ReadingsController.list);
router.post('/', ReadingsController.create);
router.put('/:id', ReadingsController.update);
router.delete('/:id', ReadingsController.delete);

export default router;

