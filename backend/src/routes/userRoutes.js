const express = require('express');
const router = express.Router();
const { searchUsers, getUserProfile, checkUsernameAvailability } = require('../controllers/userController');
const { protect, optionalAuth } = require('../middleware/auth');

router.get('/check-username', optionalAuth, checkUsernameAvailability);
router.get('/', protect, searchUsers);
router.get('/search', protect, searchUsers);
router.get('/:id', protect, getUserProfile);

module.exports = router;
