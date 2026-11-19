import {Router} from 'express';
import {protect,allowRoles} from '../middleware/auth.middleware.js';
import {listNotifications,createNotification,markRead} from '../controllers/notification.controller.js';
const router=Router();router.use(protect);router.get('/',listNotifications);router.patch('/:id/read',markRead);router.post('/',allowRoles('admin'),createNotification);export default router;
