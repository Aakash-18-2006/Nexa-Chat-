const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getCallHistory, getCallDetails } = require('../controllers/callController');

router.use(protect);

router.get('/history/:conversationId', getCallHistory);
router.get('/:callId', getCallDetails);

module.exports = router;
