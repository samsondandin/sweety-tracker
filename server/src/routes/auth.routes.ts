import { Router } from 'express';
import {
  AuthController,
  registerSchema,
  loginSchema,
  profileSchema
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

router.post('/register', validate({ body: registerSchema }), AuthController.register);
router.post('/login', validate({ body: loginSchema }), AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', requireAuth, AuthController.getMe);
router.put('/profile', requireAuth, validate({ body: profileSchema }), AuthController.updateProfile);

export default router;

