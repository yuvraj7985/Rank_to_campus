import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/student.controller.js';
import { protect, allowRoles } from '../middleware/auth.middleware.js';
const router = Router();
router.use(protect,allowRoles('student'));
router.get('/me',getProfile);
router.patch('/me',updateProfile);
export default router;
