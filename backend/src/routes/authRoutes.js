const express = require('express');
const router = express.Router();
const {
  register,
  verifyEmail,
  resendVerification,
  login,
  verify2FA,
  setup2FA,
  confirm2FA,
  disable2FA,
  regenerateRecoveryCodes,
  getSessions,
  revokeSession,
  logoutAllDevices,
  getMe,
  updateProfile,
  changePassword,
  logout,
  forgotPassword,
  validateResetToken,
  resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public Authentication Routes
router.post('/register', register);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/login', login);
router.post('/verify-2fa', verify2FA);

// Password Reset Routes
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/:token', validateResetToken);
router.post('/reset-password', resetPassword);

// Protected Routes
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.post('/logout', protect, logout);

// Two-Factor Authentication (TOTP) Routes
router.post('/2fa/setup', protect, setup2FA);
router.post('/2fa/confirm', protect, confirm2FA);
router.post('/2fa/disable', protect, disable2FA);
router.post('/2fa/regenerate-recovery-codes', protect, regenerateRecoveryCodes);

// Session Management Routes
router.get('/sessions', protect, getSessions);
router.post('/sessions/revoke', protect, revokeSession);
router.post('/sessions/logout-all', protect, logoutAllDevices);

module.exports = router;
