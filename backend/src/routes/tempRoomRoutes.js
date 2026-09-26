const express = require('express');
const router = express.Router();
const {
  createTempRoom,
  joinTempRoom,
  getTempRoom,
  sendTempMessage,
  closeTempRoom
} = require('../controllers/tempRoomController');
const { protect } = require('../middleware/auth');

router.post('/', protect, createTempRoom);
router.post('/join', protect, joinTempRoom);
router.get('/:code', protect, getTempRoom);
router.post('/:code/messages', protect, sendTempMessage);
router.delete('/:code', protect, closeTempRoom);

module.exports = router;
