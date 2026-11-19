import { Router } from 'express';
import {
  listColleges,
  createCollege,
  createBranch,
  updateCollegeStatus,
  updateBranchStatus,
  deleteCollege,
  deleteBranch,
  clearCollegeCatalog
} from '../controllers/college.controller.js';
import { protect, allowRoles } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', listColleges);
router.post('/', protect, allowRoles('admin'), createCollege);
router.post('/branches', protect, allowRoles('admin'), createBranch);
// IMPORTANT: specific paths must come BEFORE parameterised /:id routes
router.delete('/clear-all', protect, allowRoles('admin'), clearCollegeCatalog);
router.patch('/:id/status', protect, allowRoles('admin'), updateCollegeStatus);
router.delete('/:id', protect, allowRoles('admin'), deleteCollege);
router.patch('/branches/:id/status', protect, allowRoles('admin'), updateBranchStatus);
router.delete('/branches/:id', protect, allowRoles('admin'), deleteBranch);

export default router;
