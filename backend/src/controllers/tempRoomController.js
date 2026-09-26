const TemporaryRoom = require('../models/TemporaryRoom');
const crypto = require('crypto');

// Generate 6-char alphanumeric room code
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// @desc    Create a temporary room
// @route   POST /api/temp-rooms
const createTempRoom = async (req, res) => {
  try {
    const { name, durationMinutes = 60 } = req.body;
    const userId = req.user._id;

    let code = generateRoomCode();
    // Ensure uniqueness
    let existing = await TemporaryRoom.findOne({ code, active: true });
    while (existing) {
      code = generateRoomCode();
      existing = await TemporaryRoom.findOne({ code, active: true });
    }

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const room = await TemporaryRoom.create({
      code,
      name: name ? name.trim() : `Room ${code}`,
      creator: userId,
      expiresAt,
      participants: [{ user: userId, joinedAt: new Date() }],
      messages: [
        {
          senderId: userId,
          senderName: req.user.name,
          senderAvatar: req.user.avatar,
          content: `${req.user.name} opened temporary room #${code}. Messages will disappear when expired.`,
          type: 'system'
        }
      ]
    });

    return res.status(201).json({
      success: true,
      message: 'Temporary room created',
      room
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Join a temporary room by code
// @route   POST /api/temp-rooms/join
const joinTempRoom = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Room code is required' });
    }

    const cleanCode = code.toUpperCase().trim();
    const room = await TemporaryRoom.findOne({ code: cleanCode, active: true });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found or has expired' });
    }

    if (new Date() > new Date(room.expiresAt)) {
      room.active = false;
      await room.save();
      return res.status(410).json({ success: false, message: 'This temporary room has expired' });
    }

    const alreadyMember = room.participants.some(
      (p) => p.user.toString() === userId.toString()
    );

    if (!alreadyMember) {
      room.participants.push({ user: userId, joinedAt: new Date() });
      room.messages.push({
        senderId: userId,
        senderName: req.user.name,
        senderAvatar: req.user.avatar,
        content: `${req.user.name} joined the room.`,
        type: 'system'
      });
      await room.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Joined room successfully',
      room
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get temporary room details and messages
// @route   GET /api/temp-rooms/:code
const getTempRoom = async (req, res) => {
  try {
    const { code } = req.params;
    const cleanCode = code.toUpperCase().trim();

    const room = await TemporaryRoom.findOne({ code: cleanCode, active: true })
      .populate('creator', 'name username avatar')
      .populate('participants.user', 'name username avatar isOnline');

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found or expired' });
    }

    if (new Date() > new Date(room.expiresAt)) {
      room.active = false;
      await room.save();
      return res.status(410).json({ success: false, message: 'This room has expired' });
    }

    return res.status(200).json({
      success: true,
      room
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send a message in temporary room
// @route   POST /api/temp-rooms/:code/messages
const sendTempMessage = async (req, res) => {
  try {
    const { code } = req.params;
    const { content, type = 'text' } = req.body;
    const cleanCode = code.toUpperCase().trim();

    const room = await TemporaryRoom.findOne({ code: cleanCode, active: true });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found or expired' });
    }

    const newMessage = {
      senderId: req.user._id,
      senderName: req.user.name,
      senderAvatar: req.user.avatar,
      content,
      type,
      createdAt: new Date()
    };

    room.messages.push(newMessage);
    await room.save();

    const created = room.messages[room.messages.length - 1];

    return res.status(201).json({
      success: true,
      message: created
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Close / delete temporary room (Creator only)
// @route   DELETE /api/temp-rooms/:code
const closeTempRoom = async (req, res) => {
  try {
    const { code } = req.params;
    const cleanCode = code.toUpperCase().trim();

    const room = await TemporaryRoom.findOne({ code: cleanCode });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the room creator can delete this room' });
    }

    room.active = false;
    await room.save();

    return res.status(200).json({
      success: true,
      message: 'Temporary room closed successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createTempRoom,
  joinTempRoom,
  getTempRoom,
  sendTempMessage,
  closeTempRoom
};
