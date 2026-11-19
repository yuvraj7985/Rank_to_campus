import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { register, login, me } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { normalizeIndianMobileNumber } from '../utils/identity.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many authentication attempts. Try again in 15 minutes.' }
});
const emailValidator = body('email')
  .isString().withMessage('Enter a valid email address.')
  .bail()
  .trim()
  .isEmail().withMessage('Enter a valid email address.')
  .bail()
  .isLength({ max: 254 }).withMessage('Email address is too long.')
  .bail()
  .toLowerCase();
const passwordValidator = body('password')
  .isString().withMessage('Password is required.')
  .bail()
  .notEmpty().withMessage('Password is required.')
  .bail()
  .custom((value) => Buffer.byteLength(value, 'utf8') <= 72)
  .withMessage('Password must not exceed 72 UTF-8 bytes.');

router.post('/register', authLimiter, [
  body('name')
    .isString().withMessage('Enter your full name.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 80 }).withMessage('Name must be between 2 and 80 characters.')
    .bail()
    .matches(/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u).withMessage('Name can contain letters, spaces, apostrophes, periods, and hyphens.'),
  body('phone')
    .isString().withMessage('Mobile number is required.')
    .bail()
    .custom((value) => normalizeIndianMobileNumber(value) !== null)
    .withMessage('Enter a valid Indian mobile number, with or without the +91 country code.')
    .bail()
    .customSanitizer(normalizeIndianMobileNumber),
  emailValidator,
  body('password')
    .isString().withMessage('Password is required.')
    .bail()
    .isLength({ min: 8, max: 72 }).withMessage('Password must be between 8 and 72 characters.')
    .bail()
    .custom((value) => Buffer.byteLength(value, 'utf8') <= 72)
    .withMessage('Password must not exceed 72 UTF-8 bytes.')
], register);
router.post('/login', authLimiter, [
  emailValidator,
  passwordValidator
], login);
router.get('/me', protect, me);

export default router;
