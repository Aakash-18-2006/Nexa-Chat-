const express = require('express');
const router = express.Router();
const {
  sendFollowRequest,
  getIncomingRequests,
  acceptFollowRequest,
  followBackUser,
  declineFollowRequest,
  getRelationshipStatus,
  unfollowUser,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getUserFollowers,
  getUserFollowing
} = require('../controllers/followController');
const { protect } = require('../middleware/auth');

router.post('/request', protect, sendFollowRequest);
router.get('/requests/incoming', protect, getIncomingRequests);
router.post('/request/:id/accept', protect, acceptFollowRequest);
router.post('/request/:id/decline', protect, declineFollowRequest);
router.post('/back', protect, followBackUser);
router.get('/status/:targetUserId', protect, getRelationshipStatus);
router.get('/blocked', protect, getBlockedUsers);
router.get('/users/:userId/followers', protect, getUserFollowers);
router.get('/users/:userId/following', protect, getUserFollowing);
router.post('/unfollow', protect, unfollowUser);
router.post('/block', protect, blockUser);
router.post('/unblock', protect, unblockUser);

module.exports = router;
