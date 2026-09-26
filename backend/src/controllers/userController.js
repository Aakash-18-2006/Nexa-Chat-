const User = require('../models/User');
const Connection = require('../models/Connection');
const FollowRequest = require('../models/FollowRequest');
const Block = require('../models/Block');
const { enrichUsersWithRelationship } = require('./followController');

// Helper to escape regex special characters
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// @desc    Search registered users by name, username, or email
// @route   GET /api/users/search?q=...
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user._id;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(200).json({ success: true, users: [] });
    }

    const cleanQuery = q.trim();
    const safeRegex = new RegExp(escapeRegex(cleanQuery), 'i');

    // Exclude users where a block relationship exists (in either direction)
    const blocks = await Block.find({
      $or: [{ blocker: currentUserId }, { blocked: currentUserId }]
    });
    const blockedUserIds = new Set();
    blocks.forEach((b) => {
      blockedUserIds.add(b.blocker.toString());
      blockedUserIds.add(b.blocked.toString());
    });
    blockedUserIds.delete(currentUserId.toString());

    const filter = {
      _id: { $ne: currentUserId, $nin: Array.from(blockedUserIds) },
      $or: [
        { username: safeRegex },
        { name: safeRegex },
        { email: safeRegex }
      ]
    };

    // Query real users from database, only selecting safe public fields
    const users = await User.find(filter)
      .select('name username email avatar bio isOnline lastSeen')
      .limit(30);

    const usersWithStatus = await enrichUsersWithRelationship(currentUserId, users);

    return res.status(200).json({
      success: true,
      users: usersWithStatus
    });
  } catch (error) {
    console.error('[SearchUsers Error]:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error searching users' });
  }
};

// @desc    Get public user profile
// @route   GET /api/users/:id
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      'name username avatar bio isOnline lastSeen settings.privacy'
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentUserId = req.user._id;
    const targetUserId = user._id;

    // Respect privacy settings
    const result = user.toObject();
    if (result.settings?.privacy?.onlineStatus === 'nobody') {
      delete result.isOnline;
    }
    if (result.settings?.privacy?.lastSeen === 'nobody') {
      delete result.lastSeen;
    }

    if (currentUserId.toString() === targetUserId.toString()) {
      result.relationshipStatus = 'self';
    } else {
      // Check block status
      const block = await Block.findOne({
        $or: [
          { blocker: currentUserId, blocked: targetUserId },
          { blocker: targetUserId, blocked: currentUserId }
        ]
      });

      if (block) {
        result.relationshipStatus = 'blocked';
        result.isBlocker = block.blocker.toString() === currentUserId.toString();
      } else {
        // Directed follow checks
        const iFollow = await Connection.isFollowing(currentUserId, targetUserId);
        const theyFollow = await Connection.isFollowing(targetUserId, currentUserId);

        if (iFollow && theyFollow) {
          result.relationshipStatus = 'connected';
        } else if (iFollow) {
          result.relationshipStatus = 'following';
        } else if (theyFollow) {
          result.relationshipStatus = 'follow_back';
        } else {
          const sentReq = await FollowRequest.findOne({
            sender: currentUserId,
            recipient: targetUserId,
            status: 'pending'
          });
          const recReq = await FollowRequest.findOne({
            sender: targetUserId,
            recipient: currentUserId,
            status: 'pending'
          });
          const decReq = await FollowRequest.findOne({
            sender: currentUserId,
            recipient: targetUserId,
            status: 'declined'
          });

          if (sentReq) {
            result.relationshipStatus = 'pending_sent';
            result.requestId = sentReq._id;
          } else if (recReq) {
            result.relationshipStatus = 'pending_received';
            result.requestId = recReq._id;
          } else if (decReq) {
            result.relationshipStatus = 'declined';
            result.requestId = decReq._id;
          } else {
            result.relationshipStatus = 'none';
          }
        }
      }
    }

    // Calculate real follower and following counts directly from database relationships
    const followersCount = await Connection.getFollowersCount(targetUserId);
    const followingCount = await Connection.getFollowingCount(targetUserId);

    result.followersCount = followersCount;
    result.followingCount = followingCount;

    return res.status(200).json({
      success: true,
      user: result
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Check username availability in real-time
 * @route   GET /api/users/check-username?username=...
 * @access  Public / Optional Auth (identifies current user to allow current username)
 */
const checkUsernameAvailability = async (req, res) => {
  try {
    const rawUsername = req.query.username;

    if (!rawUsername || typeof rawUsername !== 'string' || rawUsername.trim().length === 0) {
      return res.status(200).json({
        available: false,
        valid: false,
        message: 'Username cannot be empty'
      });
    }

    const cleanUsername = rawUsername.trim().toLowerCase();
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;

    if (!usernameRegex.test(cleanUsername)) {
      return res.status(200).json({
        available: false,
        valid: false,
        message: 'Username must be 3–30 characters and contain only letters, numbers, and underscores.'
      });
    }

    const existingUser = await User.findOne({ username: cleanUsername });

    if (!existingUser) {
      return res.status(200).json({
        available: true,
        valid: true,
        message: 'Username available'
      });
    }

    // Check if the username belongs to the current authenticated user
    if (req.user && existingUser._id.toString() === req.user._id.toString()) {
      return res.status(200).json({
        available: true,
        valid: true,
        isCurrent: true,
        message: 'Username available'
      });
    }

    return res.status(200).json({
      available: false,
      valid: true,
      message: 'Username already in use'
    });
  } catch (error) {
    console.error('[CheckUsername Error]:', error);
    return res.status(500).json({
      available: false,
      valid: false,
      message: 'Server error checking username availability'
    });
  }
};

module.exports = {
  searchUsers,
  getUserProfile,
  checkUsernameAvailability
};

