const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Block = require('../models/Block');
const { enrichUsersWithRelationship } = require('./followController');

// Helper to escape regex special characters to prevent ReDoS and invalid regex patterns
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// @desc    Global unified search across users, conversations, and messages
// @route   GET /api/search?q=...
const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user._id;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(200).json({
        success: true,
        query: '',
        results: {
          users: [],
          conversations: [],
          messages: []
        }
      });
    }

    const cleanQuery = q.trim();
    const safeRegex = new RegExp(escapeRegex(cleanQuery), 'i');

    // Exclude users where a block relationship exists
    const blocks = await Block.find({
      $or: [{ blocker: userId }, { blocked: userId }]
    });
    const blockedUserIds = new Set();
    blocks.forEach((b) => {
      blockedUserIds.add(b.blocker.toString());
      blockedUserIds.add(b.blocked.toString());
    });
    blockedUserIds.delete(userId.toString());

    // Run user query, group query, and user conversations query in parallel
    const [users, conversations, userConvs] = await Promise.all([
      User.find({
        _id: { $ne: userId, $nin: Array.from(blockedUserIds) },
        $or: [
          { name: safeRegex },
          { username: safeRegex },
          { email: safeRegex }
        ]
      })
        .select('name username email avatar bio isOnline lastSeen')
        .limit(15)
        .lean(),
      Conversation.find({
        participants: userId,
        type: 'group',
        'groupInfo.name': safeRegex
      })
        .populate('participants', 'name username avatar')
        .limit(8)
        .lean(),
      Conversation.find({ participants: userId }).select('_id').lean()
    ]);

    const convIds = userConvs.map((c) => c._id);

    // Run user relationship enrichment and message search in parallel
    const [usersWithStatus, messages] = await Promise.all([
      enrichUsersWithRelationship(userId, users),
      convIds.length > 0
        ? Message.find({
            conversation: { $in: convIds },
            isDeleted: false,
            content: safeRegex
          })
            .populate('sender', 'name username avatar')
            .populate({
              path: 'conversation',
              select: 'type groupInfo participants',
              populate: { path: 'participants', select: 'name username avatar' }
            })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean()
        : []
    ]);

    return res.status(200).json({
      success: true,
      query: cleanQuery,
      results: {
        users: usersWithStatus,
        conversations,
        messages
      }
    });
  } catch (error) {
    console.error('[GlobalSearch Error]:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error executing search' });
  }
};

module.exports = { globalSearch };
