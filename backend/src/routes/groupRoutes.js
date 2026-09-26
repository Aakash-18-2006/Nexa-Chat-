const express = require('express');
const router = express.Router();
const {
  createGroup,
  updateGroup,
  addMembers,
  removeMember,
  leaveGroup,
  toggleAdmin
} = require('../controllers/groupController');
const { protect } = require('../middleware/auth');

router.post('/', protect, createGroup);
router.put('/:id', protect, updateGroup);
router.patch('/:id', protect, updateGroup);
router.post('/:id/members', protect, addMembers);
router.delete('/:id/members/:memberId', protect, removeMember);
router.delete('/:id/members/:userId', protect, removeMember);
router.post('/:id/leave', protect, leaveGroup);
router.put('/:id/admins', protect, toggleAdmin);

module.exports = router;
