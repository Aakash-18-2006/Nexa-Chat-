const FollowRequest = require('../models/FollowRequest');
const Connection = require('../models/Connection');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Block = require('../models/Block');

// @desc    Send a follow request
// @route   POST /api/follow/request
const sendFollowRequest = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user._id;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID is required' });
    }

    if (currentUserId.toString() === targetUserId.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if either user has blocked the other
    const isBlocked = await Block.isBlocked(currentUserId, targetUserId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot follow: interaction with this user is blocked',
        code: 'USER_BLOCKED'
      });
    }

    // 1. Check if current user already follows target user
    const alreadyFollowing = await Connection.isFollowing(currentUserId, targetUserId);
    if (alreadyFollowing) {
      return res.status(400).json({
        success: false,
        message: 'You are already following this user',
        status: 'following'
      });
    }

    // 2. If target user already follows current user, this is a Follow Back!
    const targetFollowsMe = await Connection.isFollowing(targetUserId, currentUserId);
    if (targetFollowsMe) {
      // Establish follow relationship directly without pending request
      await Connection.findOneAndUpdate(
        { follower: currentUserId, following: targetUserId },
        {
          follower: currentUserId,
          following: targetUserId,
          users: [currentUserId, targetUserId],
          connectedAt: new Date()
        },
        { upsert: true, new: true }
      );

      // Mark any pending request as accepted
      await FollowRequest.updateMany(
        {
          $or: [
            { sender: currentUserId, recipient: targetUserId, status: 'pending' },
            { sender: targetUserId, recipient: currentUserId, status: 'pending' }
          ]
        },
        { status: 'accepted' }
      );

      // Create notification
      const notification = await Notification.create({
        recipient: targetUserId,
        sender: currentUserId,
        type: 'follow_accepted',
        content: 'started following you back.',
        read: false
      });

      const populatedNotification = await Notification.findById(notification._id)
        .populate('sender', 'name username avatar');

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${targetUserId}`).emit('new_notification', populatedNotification);
        io.to(`user:${targetUserId}`).emit('relationship_changed', {
          userId: currentUserId.toString(),
          status: 'following'
        });
        io.to(`user:${currentUserId}`).emit('relationship_changed', {
          userId: targetUserId.toString(),
          status: 'following'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Followed back successfully',
        status: 'following'
      });
    }

    // 3. Check if a pending request was sent from current user to target
    const existingPending = await FollowRequest.findOne({
      sender: currentUserId,
      recipient: targetUserId,
      status: 'pending'
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: 'Follow request already pending',
        status: 'pending_sent',
        requestId: existingPending._id
      });
    }

    // 4. Check if target user already sent a pending request to current user
    const incomingPending = await FollowRequest.findOne({
      sender: targetUserId,
      recipient: currentUserId,
      status: 'pending'
    });

    if (incomingPending) {
      return res.status(400).json({
        success: false,
        message: 'This user already sent you a follow request. Please accept it in notifications.',
        status: 'pending_received',
        requestId: incomingPending._id
      });
    }

    // 5. Create or update follow request
    let followRequest = await FollowRequest.findOne({
      sender: currentUserId,
      recipient: targetUserId
    });

    if (followRequest) {
      followRequest.status = 'pending';
      followRequest.updatedAt = new Date();
      await followRequest.save();
    } else {
      followRequest = await FollowRequest.create({
        sender: currentUserId,
        recipient: targetUserId,
        status: 'pending'
      });
    }

    // 6. Create real Notification for recipient
    const notification = await Notification.create({
      recipient: targetUserId,
      sender: currentUserId,
      type: 'follow_request',
      followRequest: followRequest._id,
      content: 'sent you a follow request',
      read: false
    });

    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'name username avatar')
      .populate('followRequest');

    // 7. Real-time WebSocket emission
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${targetUserId}`).emit('new_notification', populatedNotification);
      io.to(`user:${targetUserId}`).emit('follow_request_received', {
        requestId: followRequest._id,
        sender: {
          _id: req.user._id,
          name: req.user.name,
          username: req.user.username,
          avatar: req.user.avatar
        }
      });

      io.to(`user:${currentUserId}`).emit('relationship_changed', {
        userId: targetUserId.toString(),
        status: 'pending_sent'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Follow request sent successfully',
      status: 'pending_sent',
      requestId: followRequest._id
    });
  } catch (error) {
    console.error('[SendFollowRequest Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all incoming pending follow requests
// @route   GET /api/follow/requests/incoming
const getIncomingRequests = async (req, res) => {
  try {
    const requests = await FollowRequest.find({
      recipient: req.user._id,
      status: 'pending'
    })
      .populate('sender', 'name username avatar bio isOnline lastSeen')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('[GetIncomingRequests Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Accept a follow request
// @route   POST /api/follow/request/:id/accept
const acceptFollowRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    // Must be recipient to accept
    const followRequest = await FollowRequest.findOne({
      _id: id,
      recipient: currentUserId,
      status: 'pending'
    }).populate('sender', 'name username avatar');

    if (!followRequest) {
      return res.status(404).json({
        success: false,
        message: 'Follow request not found, already processed, or access denied'
      });
    }

    const senderId = followRequest.sender._id;

    // 1. Update request status
    followRequest.status = 'accepted';
    await followRequest.save();

    // 2. Create directed Connection in database: senderId follows currentUserId
    // ONLY ONE DIRECTION: requester (senderId) -> recipient (currentUserId)
    await Connection.findOneAndUpdate(
      { follower: senderId, following: currentUserId },
      {
        follower: senderId,
        following: currentUserId,
        users: [senderId, currentUserId],
        connectedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // 3. Mark the follow_request notification as read for recipient
    await Notification.updateMany(
      { followRequest: followRequest._id, recipient: currentUserId },
      { read: true }
    );

    // 4. Create notification for the original sender that their request was accepted
    const notification = await Notification.create({
      recipient: senderId,
      sender: currentUserId,
      type: 'follow_accepted',
      followRequest: followRequest._id,
      content: 'accepted your follow request. You can now chat!',
      read: false
    });

    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'name username avatar');

    // 5. Emit real-time events to both users
    const io = req.app.get('io');
    if (io) {
      // Sender is now FOLLOWING current user
      io.to(`user:${senderId}`).emit('new_notification', populatedNotification);
      io.to(`user:${senderId}`).emit('follow_request_accepted', {
        userId: currentUserId.toString(),
        targetUser: {
          _id: req.user._id,
          name: req.user.name,
          username: req.user.username,
          avatar: req.user.avatar
        }
      });
      io.to(`user:${senderId}`).emit('relationship_changed', {
        userId: currentUserId.toString(),
        status: 'following'
      });

      // Recipient sees: FOLLOW_BACK (they have not followed sender yet)
      io.to(`user:${currentUserId}`).emit('follow_request_updated', {
        requestId: followRequest._id,
        status: 'accepted',
        relationshipStatus: 'follow_back'
      });
      io.to(`user:${currentUserId}`).emit('relationship_changed', {
        userId: senderId.toString(),
        status: 'follow_back'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Follow request accepted',
      status: 'follow_back',
      connectedUser: followRequest.sender
    });
  } catch (error) {
    console.error('[AcceptFollowRequest Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Follow back a user who is following current user
// @route   POST /api/follow/back
const followBackUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user._id;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID is required' });
    }

    if (currentUserId.toString() === targetUserId.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check block
    const isBlocked = await Block.isBlocked(currentUserId, targetUserId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot follow back: interaction with this user is blocked',
        code: 'USER_BLOCKED'
      });
    }

    // Check if current user already follows target user
    const alreadyFollowing = await Connection.isFollowing(currentUserId, targetUserId);
    if (alreadyFollowing) {
      return res.status(200).json({
        success: true,
        message: 'Already following this user',
        status: 'following'
      });
    }

    // Create the directed reverse relationship: currentUserId follows targetUserId
    await Connection.findOneAndUpdate(
      { follower: currentUserId, following: targetUserId },
      {
        follower: currentUserId,
        following: targetUserId,
        users: [currentUserId, targetUserId],
        connectedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // If there were any pending follow requests between them, update to accepted
    await FollowRequest.updateMany(
      {
        $or: [
          { sender: currentUserId, recipient: targetUserId, status: 'pending' },
          { sender: targetUserId, recipient: currentUserId, status: 'pending' }
        ]
      },
      { status: 'accepted' }
    );

    // Create notification for target user that current user followed them back
    const notification = await Notification.create({
      recipient: targetUserId,
      sender: currentUserId,
      type: 'follow_accepted',
      content: 'started following you back.',
      read: false
    });

    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'name username avatar');

    // Real-time WebSocket emission
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${targetUserId}`).emit('new_notification', populatedNotification);
      io.to(`user:${targetUserId}`).emit('relationship_changed', {
        userId: currentUserId.toString(),
        status: 'following'
      });
      io.to(`user:${currentUserId}`).emit('relationship_changed', {
        userId: targetUserId.toString(),
        status: 'following'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Followed back successfully',
      status: 'following',
      user: targetUser
    });
  } catch (error) {
    console.error('[FollowBackUser Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Decline a follow request
// @route   POST /api/follow/request/:id/decline
const declineFollowRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    // Must be recipient to decline
    const followRequest = await FollowRequest.findOne({
      _id: id,
      recipient: currentUserId,
      status: 'pending'
    });

    if (!followRequest) {
      return res.status(404).json({
        success: false,
        message: 'Follow request not found, already processed, or access denied'
      });
    }

    const senderId = followRequest.sender;

    // 1. Update status to declined
    followRequest.status = 'declined';
    await followRequest.save();

    // 2. Mark the follow_request notification as read
    await Notification.updateMany(
      { followRequest: followRequest._id, recipient: currentUserId },
      { read: true }
    );

    // 3. Emit real-time events
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${senderId}`).emit('relationship_changed', {
        userId: currentUserId.toString(),
        status: 'declined'
      });
      io.to(`user:${currentUserId}`).emit('follow_request_updated', {
        requestId: followRequest._id,
        status: 'declined'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Follow request declined',
      status: 'declined'
    });
  } catch (error) {
    console.error('[DeclineFollowRequest Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get relationship status with a target user
// @route   GET /api/follow/status/:targetUserId
const getRelationshipStatus = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user._id;

    if (currentUserId.toString() === targetUserId.toString()) {
      return res.status(200).json({ success: true, status: 'self' });
    }

    // 0. Check if either user has blocked the other
    const blockedByMe = await Block.findOne({ blocker: currentUserId, blocked: targetUserId });
    if (blockedByMe) {
      return res.status(200).json({ success: true, status: 'blocked', isBlocker: true });
    }
    const blockedByThem = await Block.findOne({ blocker: targetUserId, blocked: currentUserId });
    if (blockedByThem) {
      return res.status(200).json({ success: true, status: 'blocked', isBlocker: false });
    }

    // 1. Check directed follow relationships
    const iFollow = await Connection.isFollowing(currentUserId, targetUserId);
    const theyFollow = await Connection.isFollowing(targetUserId, currentUserId);

    if (iFollow && theyFollow) {
      return res.status(200).json({ success: true, status: 'connected' });
    }

    if (iFollow && !theyFollow) {
      return res.status(200).json({ success: true, status: 'following' });
    }

    if (!iFollow && theyFollow) {
      return res.status(200).json({ success: true, status: 'follow_back' });
    }

    // 2. Check pending request sent by current user
    const pendingSent = await FollowRequest.findOne({
      sender: currentUserId,
      recipient: targetUserId,
      status: 'pending'
    });
    if (pendingSent) {
      return res.status(200).json({
        success: true,
        status: 'pending_sent',
        requestId: pendingSent._id
      });
    }

    // 3. Check pending request received by current user
    const pendingReceived = await FollowRequest.findOne({
      sender: targetUserId,
      recipient: currentUserId,
      status: 'pending'
    });
    if (pendingReceived) {
      return res.status(200).json({
        success: true,
        status: 'pending_received',
        requestId: pendingReceived._id
      });
    }

    // 4. Check declined request sent by current user
    const declined = await FollowRequest.findOne({
      sender: currentUserId,
      recipient: targetUserId,
      status: 'declined'
    });
    if (declined) {
      return res.status(200).json({
        success: true,
        status: 'declined',
        requestId: declined._id
      });
    }

    return res.status(200).json({ success: true, status: 'none' });
  } catch (error) {
    console.error('[GetRelationshipStatus Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Unfollow a user (removes only current user's follow)
// @route   POST /api/follow/unfollow
const unfollowUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user._id;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID is required' });
    }

    // 1. Remove ONLY the current user's follow relationship to target
    await Connection.deleteMany({
      follower: currentUserId,
      following: targetUserId
    });

    // Also remove any pending follow request from current user to target
    await FollowRequest.deleteMany({
      sender: currentUserId,
      recipient: targetUserId
    });

    // 2. Check if target user is still following current user
    const targetStillFollowsMe = await Connection.isFollowing(targetUserId, currentUserId);
    const myNewStatus = targetStillFollowsMe ? 'follow_back' : 'none';
    const targetNewStatus = targetStillFollowsMe ? 'following' : 'none';

    // 3. Realtime WebSocket notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${targetUserId}`).emit('relationship_changed', {
        userId: currentUserId.toString(),
        status: targetNewStatus
      });
      io.to(`user:${currentUserId}`).emit('relationship_changed', {
        userId: targetUserId.toString(),
        status: myNewStatus
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Unfollowed successfully',
      status: myNewStatus
    });
  } catch (error) {
    console.error('[UnfollowUser Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Block a user
// @route   POST /api/follow/block
const blockUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user._id;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID is required' });
    }

    if (currentUserId.toString() === targetUserId.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot block yourself' });
    }

    // 1. Create or upsert Block record
    await Block.findOneAndUpdate(
      { blocker: currentUserId, blocked: targetUserId },
      { blocker: currentUserId, blocked: targetUserId },
      { upsert: true, new: true }
    );

    // 2. Remove any active Connections in both directions
    await Connection.deleteMany({
      $or: [
        { follower: currentUserId, following: targetUserId },
        { follower: targetUserId, following: currentUserId },
        { users: { $all: [currentUserId, targetUserId], $size: 2 } }
      ]
    });

    // 3. Remove any pending/existing FollowRequest
    await FollowRequest.deleteMany({
      $or: [
        { sender: currentUserId, recipient: targetUserId },
        { sender: targetUserId, recipient: currentUserId }
      ]
    });

    // 4. Realtime WebSocket notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${targetUserId}`).emit('relationship_changed', {
        userId: currentUserId.toString(),
        status: 'blocked',
        isBlocker: false
      });
      io.to(`user:${currentUserId}`).emit('relationship_changed', {
        userId: targetUserId.toString(),
        status: 'blocked',
        isBlocker: true
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User blocked successfully',
      status: 'blocked',
      isBlocker: true
    });
  } catch (error) {
    console.error('[BlockUser Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Unblock a user
// @route   POST /api/follow/unblock
const unblockUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user._id;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID is required' });
    }

    await Block.deleteMany({ blocker: currentUserId, blocked: targetUserId });

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${targetUserId}`).emit('relationship_changed', {
        userId: currentUserId.toString(),
        status: 'none'
      });
      io.to(`user:${currentUserId}`).emit('relationship_changed', {
        userId: targetUserId.toString(),
        status: 'none'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User unblocked successfully',
      status: 'none'
    });
  } catch (error) {
    console.error('[UnblockUser Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get list of accounts blocked by current user
// @route   GET /api/follow/blocked
const getBlockedUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const blocks = await Block.find({ blocker: currentUserId })
      .populate('blocked', 'name username avatar bio isOnline lastSeen')
      .sort({ createdAt: -1 });

    const blockedUsers = blocks
      .filter((b) => b.blocked != null)
      .map((b) => ({
        _id: b.blocked._id,
        name: b.blocked.name,
        username: b.blocked.username,
        avatar: b.blocked.avatar,
        bio: b.blocked.bio,
        blockedAt: b.createdAt
      }));

    return res.status(200).json({
      success: true,
      blockedUsers
    });
  } catch (error) {
    console.error('[GetBlockedUsers Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Helper to enrich a list of user models with relationship status relative to currentUserId
const enrichUsersWithRelationship = async (currentUserId, users) => {
  if (!users || users.length === 0) return [];
  const userIds = users.map((u) => u._id);

  // 1. Blocks
  const blocks = await Block.find({
    $or: [
      { blocker: currentUserId, blocked: { $in: userIds } },
      { blocker: { $in: userIds }, blocked: currentUserId }
    ]
  });
  const blockedIds = new Set();
  blocks.forEach((b) => {
    blockedIds.add(b.blocker.toString());
    blockedIds.add(b.blocked.toString());
  });

  // 2. Active connections in both directions
  const myFollowings = await Connection.find({ follower: currentUserId, following: { $in: userIds } });
  const myFollowers = await Connection.find({ following: currentUserId, follower: { $in: userIds } });

  const iFollowIds = new Set(myFollowings.map((c) => c.following.toString()));
  const theyFollowIds = new Set(myFollowers.map((c) => c.follower.toString()));

  // 3. Follow requests
  const followRequests = await FollowRequest.find({
    $or: [
      { sender: currentUserId, recipient: { $in: userIds } },
      { sender: { $in: userIds }, recipient: currentUserId }
    ]
  });

  return users.map((u) => {
    const uObj = u.toObject ? u.toObject() : { ...u };
    const uIdStr = u._id.toString();

    // Clean any sensitive properties
    delete uObj.password;
    delete uObj.tokens;
    delete uObj.settings;

    if (uIdStr === currentUserId.toString()) {
      uObj.relationshipStatus = 'self';
    } else if (blockedIds.has(uIdStr)) {
      uObj.relationshipStatus = 'blocked';
    } else if (iFollowIds.has(uIdStr) && theyFollowIds.has(uIdStr)) {
      uObj.relationshipStatus = 'connected'; // Mutual following
    } else if (iFollowIds.has(uIdStr)) {
      uObj.relationshipStatus = 'following'; // Current user already follows this user
    } else if (theyFollowIds.has(uIdStr)) {
      uObj.relationshipStatus = 'follow_back'; // This user follows current user, current user can follow back
    } else {
      const sentReq = followRequests.find(
        (r) =>
          r.sender.toString() === currentUserId.toString() &&
          r.recipient.toString() === uIdStr &&
          r.status === 'pending'
      );
      const recReq = followRequests.find(
        (r) =>
          r.sender.toString() === uIdStr &&
          r.recipient.toString() === currentUserId.toString() &&
          r.status === 'pending'
      );
      const decReq = followRequests.find(
        (r) =>
          r.sender.toString() === currentUserId.toString() &&
          r.recipient.toString() === uIdStr &&
          r.status === 'declined'
      );

      if (sentReq) {
        uObj.relationshipStatus = 'pending_sent';
        uObj.requestId = sentReq._id;
      } else if (recReq) {
        uObj.relationshipStatus = 'pending_received';
        uObj.requestId = recReq._id;
      } else if (decReq) {
        uObj.relationshipStatus = 'declined';
        uObj.requestId = decReq._id;
      } else {
        uObj.relationshipStatus = 'none';
      }
    }
    return uObj;
  });
};

// @desc    Get followers of a user (who follows this user)
// @route   GET /api/follow/users/:userId/followers
const getUserFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const connections = await Connection.find({ following: userId })
      .populate('follower', 'name username avatar bio isOnline lastSeen')
      .sort({ createdAt: -1 });

    const rawFollowers = connections
      .map((c) => c.follower)
      .filter((u) => u != null && u._id != null);

    const enriched = await enrichUsersWithRelationship(currentUserId, rawFollowers);

    return res.status(200).json({
      success: true,
      users: enriched
    });
  } catch (error) {
    console.error('[GetUserFollowers Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get accounts a user is following (who this user follows)
// @route   GET /api/follow/users/:userId/following
const getUserFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const connections = await Connection.find({ follower: userId })
      .populate('following', 'name username avatar bio isOnline lastSeen')
      .sort({ createdAt: -1 });

    const rawFollowing = connections
      .map((c) => c.following)
      .filter((u) => u != null && u._id != null);

    const enriched = await enrichUsersWithRelationship(currentUserId, rawFollowing);

    return res.status(200).json({
      success: true,
      users: enriched
    });
  } catch (error) {
    console.error('[GetUserFollowing Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
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
  getUserFollowing,
  enrichUsersWithRelationship
};
