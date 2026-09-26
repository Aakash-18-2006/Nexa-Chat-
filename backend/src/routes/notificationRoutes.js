const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markNotificationRead,
  markAllRead,
  deleteNotification,
  clearAllNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getNotifications);
router.put('/:id/read', protect, markNotificationRead);
router.patch('/:id/read', protect, markNotificationRead);
router.put('/read-all', protect, markAllRead);
router.delete('/clear-all', protect, clearAllNotifications);
router.delete('/:id', protect, deleteNotification);

module.exports = router;
