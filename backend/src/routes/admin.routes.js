import { Router } from 'express';

import {
    dashboard,
    reports,
    exportReports,
    resetAdmissionCycle,
    seedFreshCycle,
    listStudents,
    getStudentDetails,
    createCutoff,
    importCutoffs,
    cutoffCsvUpload,
    listCutoffs,
    updateCutoff,
    deleteCutoff,
    createAdmissionRound,
    listAdmissionRounds,
    updateAdmissionRound,
    deleteAdmissionRound
} from '../controllers/admin.controller.js';

import {
    protect,
    allowRoles
} from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect, allowRoles('admin'));

// Dashboard
router.get('/dashboard', dashboard);
router.get('/reports', reports);
router.get('/reports/export', exportReports);
router.post('/reset-cycle', resetAdmissionCycle);
router.post('/seed-fresh-cycle', seedFreshCycle);

// Students
router.get('/students', listStudents);
router.get('/students/:id', getStudentDetails);

// Cutoff Management
router.post('/cutoffs/import', cutoffCsvUpload, importCutoffs);
router.post('/cutoffs', createCutoff);
router.get('/cutoffs', listCutoffs);
router.patch('/cutoffs/:id', updateCutoff);
router.delete('/cutoffs/:id', deleteCutoff);

// Admission Round Management
router.post('/rounds', createAdmissionRound);
router.get('/rounds', listAdmissionRounds);
router.patch('/rounds/:id', updateAdmissionRound);
router.delete('/rounds/:id', deleteAdmissionRound);

export default router;