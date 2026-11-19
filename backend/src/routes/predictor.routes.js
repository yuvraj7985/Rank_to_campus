import { Router } from 'express';
import { historicalCutoffs, predict } from '../controllers/predictor.controller.js';
import { protect, allowRoles } from '../middleware/auth.middleware.js';
const router = Router();
router.post('/', predict);
router.get('/history', protect, allowRoles('student'), historicalCutoffs);
export default router;
