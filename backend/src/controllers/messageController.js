const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const Attachment = require('../models/Attachment');
const Reaction = require('../models/Reaction');
const Connection = require('../models/Connection');
const Block = require('../models/Block');

// @desc    Get messages for a conversation with pagination
// @route   GET /api/messages/:conversationId?page=1&limit=50
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Verify user belongs to conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id
    });

    if (!conversation) {
      return res.status(403).json({ success: false, message: 'Not authorized to access these messages' });
    }

    const messages = await Message.find({ conversation: conversationId })
      .select('content type attachments replyTo reactions readBy deliveredTo isEdited isDeleted isPinned createdAt conversation sender callDetails')
      .populate('sender', 'name username avatar')
      .populate({
        path: 'replyTo',
        select: 'content sender type attachments',
        populate: { path: 'sender', select: 'name username avatar' }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .lean();

    const hasMore = messages.length > limit;
    const pageMessages = hasMore ? messages.slice(0, limit) : messages;

    // Reverse so client gets chronological order
    const chronological = pageMessages.reverse();

    return res.status(200).json({
      success: true,
      messages: chronological,
      pagination: {
        page,
        limit,
        hasMore
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send a new message
// @route   POST /api/messages
const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, type = 'text', attachments = [], replyTo = null } = req.body;
    const senderId = req.user._id;

    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Conversation ID is required' });
    }

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ success: false, message: 'Message content or attachment is required' });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: senderId
    });

    if (!conversation) {
      return res.status(403).json({ success: false, message: 'Unauthorized or conversation not found' });
    }

    // Security check: If direct conversation, verify that both users are connected and not blocked
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants.find(
        (p) => p.toString() !== senderId.toString()
      );
      if (otherParticipant) {
        const isBlocked = await Block.isBlocked(senderId, otherParticipant);
        if (isBlocked) {
          return res.status(403).json({
            success: false,
            message: 'Cannot send message: communication with this user is blocked.',
            code: 'USER_BLOCKED'
          });
        }

        const isConnected = await Connection.areUsersConnected(senderId, otherParticipant);
        if (!isConnected) {
          return res.status(403).json({
            success: false,
            message: 'Cannot send message: users are not connected. Both users must accept follow request to chat.',
            code: 'NOT_CONNECTED'
          });
        }
      }
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: senderId,
      content: content || '',
      type,
      attachments,
      replyTo: replyTo || null,
      readBy: [{ user: senderId, readAt: new Date() }],
      deliveredTo: [{ user: senderId, deliveredAt: new Date() }]
    });

    // Update conversation lastMessage & timestamp
    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    // Persist attachments to Attachment model if provided
    if (attachments && attachments.length > 0) {
      try {
        await Attachment.insertMany(
          attachments.map((att) => ({
            messageId: message._id,
            uploaderId: senderId,
            url: att.url,
            originalName: att.name || 'attachment',
            fileType: att.type || 'file',
            mimeType: att.mimeType || 'application/octet-stream',
            size: att.size || 0
          }))
        );
      } catch (attErr) {
        console.error('[Attachment Save Error]:', attErr);
      }
    }

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name username avatar')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'name username avatar' }
      });

    // Broadcast real-time event to conversation room via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).to(conversationId.toString()).emit('receive_message', populatedMessage);
      if (conversation.participants) {
        const otherParticipants = conversation.participants.filter(
          (pId) => pId.toString() !== senderId.toString()
        );

        if (otherParticipants.length > 0) {
          const notifDocs = otherParticipants.map((pId) => ({
            recipient: pId,
            sender: senderId,
            type: replyTo ? 'reply' : 'message',
            conversation: conversationId,
            message: message._id,
            content: content || 'Sent an attachment'
          }));

          Notification.insertMany(notifDocs, { ordered: false }).catch((err) =>
            console.error('[Notification Batch Save Error]:', err)
          );

          otherParticipants.forEach((pId) => {
            const participantIdStr = pId.toString();
            io.to(`user:${participantIdStr}`).emit('new_message_notification', {
              conversationId,
              message: populatedMessage
            });
            io.to(`user:${participantIdStr}`).emit('new_notification', {
              recipient: pId,
              sender: {
                _id: req.user._id,
                name: req.user.name,
                username: req.user.username,
                avatar: req.user.avatar
              },
              type: replyTo ? 'reply' : 'message',
              conversation: {
                _id: conversation._id,
                type: conversation.type,
                groupInfo: conversation.groupInfo
              },
              message: message._id,
              content: content || 'Sent an attachment',
              read: false,
              createdAt: new Date()
            });
          });
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: populatedMessage
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Edit an existing message
// @route   PUT /api/messages/:id
const editMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages' });
    }

    if (message.isDeleted) {
      return res.status(400).json({ success: false, message: 'Cannot edit a deleted message' });
    }

    message.content = content.trim();
    message.isEdited = true;
    await message.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'name username avatar')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'name username avatar' }
      });

    // Broadcast real-time edit to conversation room
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).to(message.conversation.toString()).emit('message_edited', populated);
    }

    return res.status(200).json({
      success: true,
      message: populated
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:id
const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const conversation = await Conversation.findById(message.conversation);
    const isSender = message.sender.toString() === req.user._id.toString();
    const isGroupAdmin =
      conversation &&
      conversation.type === 'group' &&
      conversation.groupInfo?.adminIds?.some((a) => a.toString() === req.user._id.toString());

    if (!isSender && !isGroupAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this message' });
    }

    message.isDeleted = true;
    message.content = 'This message was deleted';
    message.attachments = [];
    await message.save();

    // Broadcast real-time deletion to conversation room
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).to(message.conversation.toString()).emit('message_deleted', {
        messageId: message._id,
        conversationId: message.conversation
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
      deletedMessageId: message._id
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add or toggle reaction on a message
// @route   POST /api/messages/:id/react
const reactToMessage = async (req, res) => {
  try {
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji) {
      return res.status(400).json({ success: false, message: 'Emoji is required' });
    }

    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Check if user already reacted with this exact emoji
    const existingIndex = message.reactions.findIndex(
      (r) => r.user.toString() === userId.toString() && r.emoji === emoji
    );

    if (existingIndex > -1) {
      // Toggle off
      message.reactions.splice(existingIndex, 1);
      try {
        await Reaction.deleteOne({ messageId: message._id, userId, emoji });
      } catch (rErr) {
        console.error('[Reaction Sync Error]:', rErr);
      }
    } else {
      // Remove any previous reaction by this user or allow multiple
      const userPrevReaction = message.reactions.findIndex(
        (r) => r.user.toString() === userId.toString()
      );
      if (userPrevReaction > -1) {
        const oldEmoji = message.reactions[userPrevReaction].emoji;
        message.reactions[userPrevReaction].emoji = emoji;
        try {
          await Reaction.deleteOne({ messageId: message._id, userId, emoji: oldEmoji });
          await Reaction.create({ messageId: message._id, userId, emoji });
        } catch (rErr) {
          console.error('[Reaction Sync Error]:', rErr);
        }
      } else {
        message.reactions.push({ user: userId, emoji });
        try {
          await Reaction.create({ messageId: message._id, userId, emoji });
        } catch (rErr) {
          console.error('[Reaction Sync Error]:', rErr);
        }
      }
    }

    await message.save();

    // Broadcast reaction change to conversation room
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${message.conversation}`).to(message.conversation.toString()).emit('message_reaction', {
        messageId: message._id,
        reactions: message.reactions
      });
    }

    return res.status(200).json({
      success: true,
      reactions: message.reactions
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark conversation messages as read
// @route   POST /api/messages/:conversationId/read
const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    await Message.updateMany(
      {
        conversation: conversationId,
        'readBy.user': { $ne: userId }
      },
      {
        $addToSet: {
          readBy: { user: userId, readAt: new Date() },
          deliveredTo: { user: userId, deliveredAt: new Date() }
        }
      }
    );

    return res.status(200).json({ success: true, message: 'Marked as read' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all media, files, and audio for a conversation
// @route   GET /api/messages/:conversationId/media
const getConversationMedia = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({
      conversation: conversationId,
      'attachments.0': { $exists: true },
      isDeleted: false
    })
      .select('attachments sender createdAt type')
      .populate('sender', 'name username')
      .sort({ createdAt: -1 });

    const mediaList = [];
    messages.forEach((msg) => {
      msg.attachments.forEach((att) => {
        mediaList.push({
          ...att.toObject(),
          messageId: msg._id,
          sender: msg.sender,
          createdAt: msg.createdAt
        });
      });
    });

    return res.status(200).json({
      success: true,
      media: mediaList
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Search messages across user conversations
// @route   GET /api/messages/search?q=...&conversationId=...
const searchMessages = async (req, res) => {
  try {
    const { q, conversationId } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const query = {
      content: { $regex: q.trim(), $options: 'i' },
      isDeleted: false
    };

    if (conversationId) {
      query.conversation = conversationId;
    } else {
      const userConvs = await Conversation.find({ participants: req.user._id }).select('_id');
      query.conversation = { $in: userConvs.map((c) => c._id) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'name username avatar')
      .populate('conversation', 'type groupInfo')
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      messages,
      total: messages.length
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  markAsRead,
  getConversationMedia,
  searchMessages
};
