import { Router } from 'express';
import { protect, allowRoles } from '../middleware/auth.middleware.js';
import {
  runAllocation,
  myAllocation,
  listAllocations,
  respondToAllocation
} from '../controllers/allocation.controller.js';

const router = Router();

// Student routes
router.get('/mine', protect, allowRoles('student'), myAllocation);
router.patch('/:id/respond', protect, allowRoles('student'), respondToAllocation);

// Admin routes
router.get('/', protect, allowRoles('admin'), listAllocations);
router.post('/run/:roundId', protect, allowRoles('admin'), runAllocation);

export default router;
