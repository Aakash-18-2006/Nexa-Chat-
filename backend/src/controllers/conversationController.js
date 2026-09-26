const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Connection = require('../models/Connection');
const Block = require('../models/Block');

// @desc    Get all conversations for logged in user
// @route   GET /api/conversations
const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Filter out conversations that this user has removed/deleted from their list
    const rawConversations = await Conversation.find({
      participants: userId,
      deletedBy: { $ne: userId }
    })
      .populate('participants', 'name username email avatar isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name username avatar' }
      })
      .populate({
        path: 'pinnedMessages',
        populate: { path: 'sender', select: 'name username avatar' }
      })
      .sort({ updatedAt: -1 });

    // Sort pinned conversations to the top for the current user
    const conversations = rawConversations.sort((a, b) => {
      const aPinned = a.pinnedBy?.some((id) => id.toString() === userId.toString()) ? 1 : 0;
      const bPinned = b.pinnedBy?.some((id) => id.toString() === userId.toString()) ? 1 : 0;
      if (aPinned !== bPinned) {
        return bPinned - aPinned; // pinned conversations first
      }
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    return res.status(200).json({
      success: true,
      conversations
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get or create direct 1-to-1 conversation
// @route   POST /api/conversations/direct
const getOrCreateDirect = async (req, res) => {
  try {
    const { participantId } = req.body;
    const currentUserId = req.user._id;

    if (!participantId) {
      return res.status(400).json({ success: false, message: 'Participant ID is required' });
    }

    if (participantId === currentUserId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot start a direct chat with yourself' });
    }

    // Security check: Check if either user has blocked the other
    const isBlocked = await Block.isBlocked(currentUserId, participantId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Unable to communicate with this user.',
        code: 'USER_BLOCKED'
      });
    }

    // Security check: Must be connected via accepted follow request
    const isConnected = await Connection.areUsersConnected(currentUserId, participantId);
    if (!isConnected) {
      return res.status(403).json({
        success: false,
        message: 'You must follow and be accepted before you can message this user.',
        code: 'NOT_CONNECTED'
      });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [currentUserId, participantId], $size: 2 }
    })
      .populate('participants', 'name username email avatar isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name username avatar' }
      });

    if (!conversation) {
      conversation = await Conversation.create({
        type: 'direct',
        participants: [currentUserId, participantId]
      });

      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'name username email avatar isOnline lastSeen');
    }

    return res.status(200).json({
      success: true,
      conversation
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a conversation (direct or group)
// @route   POST /api/conversations
const createConversation = async (req, res) => {
  try {
    const { type = 'direct', participantId, participants = [], name, description, avatar } = req.body;
    const currentUserId = req.user._id;

    if (type === 'direct') {
      const targetId = participantId || participants.find((p) => p.toString() !== currentUserId.toString());
      if (!targetId) {
        return res.status(400).json({ success: false, message: 'Participant ID is required for direct chat' });
      }
      if (targetId.toString() === currentUserId.toString()) {
        return res.status(400).json({ success: false, message: 'Cannot start a direct chat with yourself' });
      }

      // Security check: Check if either user has blocked the other
      const isBlocked = await Block.isBlocked(currentUserId, targetId);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'Unable to communicate with this user.',
          code: 'USER_BLOCKED'
        });
      }

      // Security check: Must be connected via accepted follow request
      const isConnected = await Connection.areUsersConnected(currentUserId, targetId);
      if (!isConnected) {
        return res.status(403).json({
          success: false,
          message: 'You must follow and be accepted before you can message this user.',
          code: 'NOT_CONNECTED'
        });
      }

      let conversation = await Conversation.findOne({
        type: 'direct',
        participants: { $all: [currentUserId, targetId], $size: 2 }
      })
        .populate('participants', 'name username email avatar isOnline lastSeen')
        .populate({
          path: 'lastMessage',
          populate: { path: 'sender', select: 'name username avatar' }
        });

      if (!conversation) {
        conversation = await Conversation.create({
          type: 'direct',
          participants: [currentUserId, targetId]
        });

        conversation = await Conversation.findById(conversation._id)
          .populate('participants', 'name username email avatar isOnline lastSeen');
      }

      return res.status(200).json({
        success: true,
        conversation
      });
    } else {
      // Group conversation
      const allParticipants = Array.from(
        new Set([currentUserId.toString(), ...participants.map((p) => p.toString())])
      );

      const conversation = await Conversation.create({
        type: 'group',
        participants: allParticipants,
        groupInfo: {
          name: name || 'New Group',
          description: description || '',
          avatar: avatar || '',
          adminIds: [currentUserId],
          createdBy: currentUserId
        }
      });

      const populated = await Conversation.findById(conversation._id)
        .populate('participants', 'name username email avatar isOnline lastSeen')
        .populate('groupInfo.adminIds', 'name username avatar');

      return res.status(201).json({
        success: true,
        conversation: populated
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get conversation by ID
// @route   GET /api/conversations/:id
const getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: req.user._id
    })
      .populate('participants', 'name username email avatar isOnline lastSeen')
      .populate({
        path: 'groupInfo.adminIds',
        select: 'name username avatar'
      })
      .populate({
        path: 'pinnedMessages',
        populate: { path: 'sender', select: 'name username avatar' }
      });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found or access denied' });
    }

    return res.status(200).json({
      success: true,
      conversation
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Pin a message in conversation
// @route   POST /api/conversations/:id/pin/:messageId
const pinMessage = async (req, res) => {
  try {
    const { id, messageId } = req.params;

    const conversation = await Conversation.findOne({ _id: id, participants: req.user._id });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const message = await Message.findById(messageId);
    if (!message || message.conversation.toString() !== id) {
      return res.status(404).json({ success: false, message: 'Message not found in this conversation' });
    }

    if (!conversation.pinnedMessages.includes(messageId)) {
      conversation.pinnedMessages.push(messageId);
      await conversation.save();
    }

    message.isPinned = true;
    await message.save();

    return res.status(200).json({
      success: true,
      message: 'Message pinned successfully',
      pinnedMessages: conversation.pinnedMessages
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Unpin a message in conversation
// @route   DELETE /api/conversations/:id/pin/:messageId
const unpinMessage = async (req, res) => {
  try {
    const { id, messageId } = req.params;

    const conversation = await Conversation.findOne({ _id: id, participants: req.user._id });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    conversation.pinnedMessages = conversation.pinnedMessages.filter(
      (mId) => mId.toString() !== messageId
    );
    await conversation.save();

    await Message.findByIdAndUpdate(messageId, { isPinned: false });

    return res.status(200).json({
      success: true,
      message: 'Message unpinned successfully',
      pinnedMessages: conversation.pinnedMessages
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle pin conversation for logged in user
// @route   POST /api/conversations/:id/pin
const togglePinConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found or access denied' });
    }

    const isPinned = conversation.pinnedBy?.some((uid) => uid.toString() === userId.toString());

    if (isPinned) {
      conversation.pinnedBy = conversation.pinnedBy.filter((uid) => uid.toString() !== userId.toString());
    } else {
      if (!conversation.pinnedBy) conversation.pinnedBy = [];
      conversation.pinnedBy.push(userId);
    }

    await conversation.save();

    return res.status(200).json({
      success: true,
      isPinned: !isPinned,
      message: !isPinned ? 'Conversation pinned' : 'Conversation unpinned',
      conversationId: id
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete single conversation from logged in user's chat list
// @route   DELETE /api/conversations/:id
const deleteConversationForUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found or access denied' });
    }

    if (!conversation.deletedBy) conversation.deletedBy = [];
    if (!conversation.deletedBy.some((uid) => uid.toString() === userId.toString())) {
      conversation.deletedBy.push(userId);
      await conversation.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Conversation removed from your chat list',
      conversationId: id
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete multiple conversations from logged in user's chat list
// @route   POST /api/conversations/delete-multiple
const deleteMultipleConversations = async (req, res) => {
  try {
    const { conversationIds } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.status(400).json({ success: false, message: 'conversationIds array is required' });
    }

    await Conversation.updateMany(
      {
        _id: { $in: conversationIds },
        participants: userId
      },
      {
        $addToSet: { deletedBy: userId }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Conversations removed from your chat list',
      deletedIds: conversationIds
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getConversations,
  getOrCreateDirect,
  createConversation,
  getConversationById,
  pinMessage,
  unpinMessage,
  togglePinConversation,
  deleteConversationForUser,
  deleteMultipleConversations
};
