const Call = require('../models/Call');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Block = require('../models/Block');
const Connection = require('../models/Connection');

// Helper to log call event as a message in the conversation
const recordCallMessage = async (call, io) => {
  try {
    const conversation = await Conversation.findById(call.conversationId);
    if (!conversation) return null;

    let content = '';
    const typeLabel = call.callType === 'video' ? 'Video Call' : 'Audio Call';

    if (call.status === 'ended') {
      const mins = Math.floor((call.duration || 0) / 60);
      const secs = (call.duration || 0) % 60;
      const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      content = `${typeLabel} • ${durationStr}`;
    } else if (call.status === 'missed') {
      content = `Missed ${typeLabel}`;
    } else if (call.status === 'declined') {
      content = `Declined ${typeLabel}`;
    } else if (call.status === 'busy') {
      content = `${typeLabel} • Line Busy`;
    } else if (call.status === 'unavailable') {
      content = `${typeLabel} • User Unavailable`;
    } else if (call.status === 'cancelled') {
      content = `Cancelled ${typeLabel}`;
    } else {
      content = `${typeLabel} • ${call.status}`;
    }

    const message = await Message.create({
      conversation: call.conversationId,
      conversationId: call.conversationId,
      sender: call.caller,
      senderId: call.caller,
      content,
      type: 'call',
      callDetails: {
        callId: call._id,
        callType: call.callType,
        status: call.status,
        duration: call.duration || 0
      },
      readBy: [{ user: call.caller, readAt: new Date() }],
      deliveredTo: [{ user: call.caller, deliveredAt: new Date() }]
    });

    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name username avatar')
      .populate({
        path: 'conversation',
        select: 'participants type groupInfo'
      });

    if (io) {
      io.to(`conversation:${call.conversationId}`).emit('receive_message', populatedMessage);
      io.to(call.conversationId.toString()).emit('receive_message', populatedMessage);

      // Emit notification to receiver for missed calls
      if (call.status === 'missed' || call.status === 'declined') {
        io.to(`user:${call.receiver}`).emit('new_message_notification', {
          message: populatedMessage
        });
      }
    }

    return populatedMessage;
  } catch (err) {
    console.error('Error recording call message:', err);
    return null;
  }
};

// @desc    Get call history for a conversation
// @route   GET /api/calls/history/:conversationId
const getCallHistory = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user._id;

    // Verify user is in conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId
    });

    if (!conversation) {
      return res.status(403).json({ success: false, message: 'Access denied to conversation' });
    }

    const calls = await Call.find({ conversationId })
      .populate('caller', 'name username avatar isOnline')
      .populate('receiver', 'name username avatar isOnline')
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      calls
    });
  } catch (error) {
    console.error('[GetCallHistory Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get details of a specific call
// @route   GET /api/calls/:callId
const getCallDetails = async (req, res) => {
  try {
    const { callId } = req.params;
    const currentUserId = req.user._id;

    const call = await Call.findById(callId)
      .populate('caller', 'name username avatar isOnline')
      .populate('receiver', 'name username avatar isOnline');

    if (!call) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }

    if (
      call.caller._id.toString() !== currentUserId.toString() &&
      call.receiver._id.toString() !== currentUserId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.status(200).json({
      success: true,
      call
    });
  } catch (error) {
    console.error('[GetCallDetails Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCallHistory,
  getCallDetails,
  recordCallMessage
};
