import { Router } from 'express';
import AdmissionRound from '../models/AdmissionRound.js';

const router = Router();
router.get('/', async (_req, res, next) => {
  try {
    const rounds = await AdmissionRound.find({
      status: 'open'
    })
      .select('name year status startsAt endsAt')
      .sort({ year: -1, createdAt: -1 });
    res.json({ success: true, data: rounds });
  } catch (error) {
    next(error);
  }
});

export default router;
