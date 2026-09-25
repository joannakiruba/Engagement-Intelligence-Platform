import { Router } from 'express';
import Joi from 'joi';
import {
  login,
  logout,
  refresh,
  activate,
  resendActivation,
  forgotPassword,
  resetPassword,
  changePassword,
} from '../auth/auth.controller';
import { authenticateJwt } from '../auth/jwt.middleware';
import { validate } from '../middleware/validate.middleware';
import { authRateLimit, strictAuthRateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const activateSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(12).max(128).required(),
});

const resendActivationSchema = Joi.object({
  email: Joi.string().email().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(12).max(128).required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(12).max(128).required(),
});

router.post('/login', authRateLimit, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', authenticateJwt, logout);

router.post('/activate', authRateLimit, validate(activateSchema), activate);
router.post('/resend-activation', strictAuthRateLimit, validate(resendActivationSchema), resendActivation);

router.post('/forgot-password', strictAuthRateLimit, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authRateLimit, validate(resetPasswordSchema), resetPassword);

router.post('/change-password', authenticateJwt, validate(changePasswordSchema), changePassword);

export default router;
