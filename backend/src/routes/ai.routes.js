import {Router} from 'express';
import {protect} from '../middleware/auth.middleware.js';
import {chat,history} from '../controllers/ai.controller.js';
const router=Router();router.use(protect);router.post('/chat',chat);router.get('/history',history);export default router;
