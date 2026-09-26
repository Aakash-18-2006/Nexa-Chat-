const express = require('express');
const router = express.Router();
const {
  getAccountInfo,
  requestEmailChange,
  confirmEmailChange,
  changeUsername
} = require('../controllers/accountController');
const { protect } = require('../middleware/auth');

// Protected account routes
router.get('/info', protect, getAccountInfo);
router.post('/change-email', protect, requestEmailChange);
router.post('/change-username', protect, changeUsername);

// Direct email change confirmation routes (invoked when user clicks "Confirm Email Change" in Gmail)
router.get('/confirm-email-change', confirmEmailChange);
router.get('/confirm-email-change/:token', confirmEmailChange);
router.post('/confirm-email-change', confirmEmailChange);

module.exports = router;
