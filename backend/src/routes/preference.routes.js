import {Router} from 'express';
import {protect,allowRoles} from '../middleware/auth.middleware.js';
import {savePreferences,lockPreferences,getMyPreferences} from '../controllers/preference.controller.js';
const router=Router();router.use(protect,allowRoles('student'));
router.get('/mine',getMyPreferences);router.put('/',savePreferences);router.post('/:roundId/lock',lockPreferences);
export default router;
