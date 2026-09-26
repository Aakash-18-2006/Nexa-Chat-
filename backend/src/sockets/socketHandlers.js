const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Connection = require('../models/Connection');
const Block = require('../models/Block');
const Call = require('../models/Call');
const { recordCallMessage } = require('../controllers/callController');

// Map to track user presence: userId -> Set of socketIds
const onlineUsers = new Map();

// In-memory active calls tracking:
// activeCalls: callId -> { callId, callerId, receiverId, conversationId, callType, status, startedAt, connectedAt, timeoutTimer }
const activeCalls = new Map();
// userActiveCall: userId -> callId
const userActiveCall = new Map();

const initSocketHandlers = (io) => {
  // Socket.IO Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'nexa_production_grade_jwt_secret_token_key_9948271'
      );

      if (decoded.twoFactorPending) {
        return next(new Error('Two-factor authentication required'));
      }

      const user = await User.findById(decoded.id).select('name username avatar');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token: ' + err.message));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();

    // 1. Presence: Add to online users
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
      await User.findByIdAndUpdate(userId, { isOnline: true });
      io.emit('user_online', { userId, timestamp: new Date() });
    }
    onlineUsers.get(userId).add(socket.id);

    // Join personal room for personal direct notifications/events
    socket.join(`user:${userId}`);

    // Send currently online users list to connecting client
    const currentOnlineIds = Array.from(onlineUsers.keys());
    socket.emit('online_users_list', currentOnlineIds);

    // 2. Conversation Room Joining & Leaving
    socket.on('join_conversation', (data, callback) => {
      const convId = typeof data === 'object' && data !== null ? data.conversationId : data;
      if (convId) {
        socket.join(`conversation:${convId}`);
        socket.join(convId.toString());
        if (typeof callback === 'function') callback({ success: true, room: `conversation:${convId}` });
      }
    });

    socket.on('leave_conversation', (data, callback) => {
      const convId = typeof data === 'object' && data !== null ? data.conversationId : data;
      if (convId) {
        socket.leave(`conversation:${convId}`);
        socket.leave(convId.toString());
        if (typeof callback === 'function') callback({ success: true });
      }
    });

    // 3. Typing Indicators
    socket.on('typing_start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing_start', {
        conversationId,
        user: {
          _id: socket.user._id,
          name: socket.user.name,
          username: socket.user.username
        }
      });
    });

    socket.on('typing_stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing_stop', {
        conversationId,
        userId: socket.user._id
      });
    });

    // 4. Real-time Messages
    socket.on('send_message', async (messageData) => {
      try {
        const { conversationId, content, type = 'text', attachments = [], replyTo = null } = messageData;

        // Verify participant
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.user._id
        });

        if (!conversation) return;

        // Security check: If direct conversation, verify that both users are connected and not blocked
        if (conversation.type === 'direct') {
          const otherParticipant = conversation.participants.find(
            (p) => p.toString() !== socket.user._id.toString()
          );
          if (otherParticipant) {
            const isBlocked = await Block.isBlocked(socket.user._id, otherParticipant);
            if (isBlocked) {
              socket.emit('message_error', {
                conversationId,
                message: 'Cannot send message: communication with this user is blocked.'
              });
              return;
            }

            const isConnected = await Connection.areUsersConnected(socket.user._id, otherParticipant);
            if (!isConnected) {
              socket.emit('message_error', {
                conversationId,
                message: 'Cannot send message: users are not connected. Both users must accept follow request to chat.'
              });
              return;
            }
          }
        }

        const message = await Message.create({
          conversation: conversationId,
          sender: socket.user._id,
          content: content || '',
          type,
          attachments,
          replyTo,
          readBy: [{ user: socket.user._id, readAt: new Date() }],
          deliveredTo: [{ user: socket.user._id, deliveredAt: new Date() }]
        });

        conversation.lastMessage = message._id;
        conversation.updatedAt = new Date();
        await conversation.save();

        const populated = await Message.findById(message._id)
          .populate('sender', 'name username avatar')
          .populate({
            path: 'replyTo',
            populate: { path: 'sender', select: 'name username avatar' }
          });

        // Broadcast to everyone in conversation room (including sender)
        io.to(`conversation:${conversationId}`).emit('receive_message', populated);

        // Also notify offline participants via personal user rooms
        conversation.participants.forEach(async (pId) => {
          const participantIdStr = pId.toString();
          if (participantIdStr !== userId) {
            io.to(`user:${participantIdStr}`).emit('new_message_notification', {
              conversationId,
              message: populated
            });

            // Create persistent in-app notification
            try {
              const notif = await Notification.create({
                recipient: pId,
                sender: socket.user._id,
                type: replyTo ? 'reply' : 'message',
                conversation: conversationId,
                message: message._id,
                content: content || 'Sent an attachment'
              });

              const populatedNotif = await Notification.findById(notif._id)
                .populate('sender', 'name username avatar')
                .populate('conversation', 'type groupInfo');

              io.to(`user:${participantIdStr}`).emit('new_notification', populatedNotif);
            } catch (notifErr) {
              console.error('Failed to create/emit notification:', notifErr);
            }
          }
        });
      } catch (err) {
        socket.emit('error_message', { message: 'Failed to send message: ' + err.message });
      }
    });

    // 5. Message Reactions
    socket.on('message_reaction', async ({ messageId, emoji, conversationId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const existingIndex = message.reactions.findIndex(
          (r) => r.user.toString() === userId && r.emoji === emoji
        );

        if (existingIndex > -1) {
          message.reactions.splice(existingIndex, 1);
          io.to(`conversation:${conversationId}`).emit('reaction_removed', {
            messageId,
            userId,
            emoji,
            conversationId
          });
        } else {
          message.reactions.push({ user: socket.user._id, emoji });
          io.to(`conversation:${conversationId}`).emit('reaction_added', {
            messageId,
            userId,
            emoji,
            conversationId
          });

          // Persistent notification for message sender if someone else reacts
          if (message.sender.toString() !== userId) {
            try {
              const notif = await Notification.create({
                recipient: message.sender,
                sender: socket.user._id,
                type: 'reaction',
                conversation: conversationId,
                message: message._id,
                content: `Reacted with ${emoji}`
              });
              const populatedNotif = await Notification.findById(notif._id)
                .populate('sender', 'name username avatar')
                .populate('conversation', 'type groupInfo');
              io.to(`user:${message.sender.toString()}`).emit('new_notification', populatedNotif);
            } catch (err) {
              console.error('Reaction notification error:', err);
            }
          }
        }
        await message.save();

        io.to(`conversation:${conversationId}`).emit('message_reaction_updated', {
          messageId,
          reactions: message.reactions,
          conversationId
        });
      } catch (err) {
        console.error('Reaction error:', err);
      }
    });

    socket.on('reaction_added', async ({ messageId, emoji, conversationId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;
        const exists = message.reactions.some(
          (r) => r.user.toString() === userId && r.emoji === emoji
        );
        if (!exists) {
          message.reactions.push({ user: socket.user._id, emoji });
          await message.save();
        }
        io.to(`conversation:${conversationId}`).emit('reaction_added', {
          messageId,
          userId,
          emoji,
          conversationId
        });
        io.to(`conversation:${conversationId}`).emit('message_reaction_updated', {
          messageId,
          reactions: message.reactions,
          conversationId
        });
      } catch (err) {
        console.error('reaction_added error:', err);
      }
    });

    socket.on('reaction_removed', async ({ messageId, emoji, conversationId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;
        message.reactions = message.reactions.filter(
          (r) => !(r.user.toString() === userId && r.emoji === emoji)
        );
        await message.save();
        io.to(`conversation:${conversationId}`).emit('reaction_removed', {
          messageId,
          userId,
          emoji,
          conversationId
        });
        io.to(`conversation:${conversationId}`).emit('message_reaction_updated', {
          messageId,
          reactions: message.reactions,
          conversationId
        });
      } catch (err) {
        console.error('reaction_removed error:', err);
      }
    });

    // 6. Message Delivery & Read Receipts
    socket.on('message_delivered', async ({ messageId, conversationId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, {
          $addToSet: { deliveredTo: { user: socket.user._id, deliveredAt: new Date() } }
        });
        io.to(`conversation:${conversationId}`).emit('message_delivered', {
          messageId,
          conversationId,
          userId: socket.user._id,
          deliveredAt: new Date()
        });
      } catch (err) {
        console.error('Delivery receipt error:', err);
      }
    });

    socket.on('message_read', async ({ conversationId }) => {
      try {
        await Message.updateMany(
          { conversation: conversationId, 'readBy.user': { $ne: socket.user._id } },
          { $addToSet: { readBy: { user: socket.user._id, readAt: new Date() } } }
        );

        io.to(`conversation:${conversationId}`).emit('message_read', {
          conversationId,
          userId: socket.user._id,
          readAt: new Date()
        });
        io.to(`conversation:${conversationId}`).emit('messages_marked_read', {
          conversationId,
          userId: socket.user._id,
          readAt: new Date()
        });
      } catch (err) {
        console.error('Read receipt error:', err);
      }
    });

    // 7. Message Edits & Deletions
    socket.on('message_updated', ({ conversationId, message }) => {
      io.to(`conversation:${conversationId}`).emit('message_updated', {
        conversationId,
        message
      });
      io.to(`conversation:${conversationId}`).emit('message_edited', {
        conversationId,
        message
      });
    });

    socket.on('message_edited', ({ conversationId, message }) => {
      io.to(`conversation:${conversationId}`).emit('message_updated', {
        conversationId,
        message
      });
      io.to(`conversation:${conversationId}`).emit('message_edited', {
        conversationId,
        message
      });
    });

    socket.on('message_deleted', ({ conversationId, messageId }) => {
      io.to(`conversation:${conversationId}`).emit('message_deleted', {
        conversationId,
        messageId
      });
    });

    // 8. Temporary Room Socket Events
    socket.on('temp_room_join', ({ code }) => {
      if (code) {
        socket.join(`temp_room:${code.toUpperCase()}`);
        io.to(`temp_room:${code.toUpperCase()}`).emit('temp_room_user_joined', {
          user: socket.user
        });
      }
    });

    socket.on('temp_room_leave', ({ code }) => {
      if (code) {
        socket.leave(`temp_room:${code.toUpperCase()}`);
      }
    });

    socket.on('temp_room_send_message', async ({ code, content, type = 'text' }) => {
      try {
        const TemporaryRoom = require('../models/TemporaryRoom');
        const room = await TemporaryRoom.findOne({ code: code.toUpperCase(), active: true });
        if (!room) return;

        const newMsg = {
          senderId: socket.user._id,
          senderName: socket.user.name,
          senderAvatar: socket.user.avatar,
          content,
          type,
          createdAt: new Date()
        };

        room.messages.push(newMsg);
        await room.save();

        const savedMsg = room.messages[room.messages.length - 1];
        io.to(`temp_room:${code.toUpperCase()}`).emit('temp_room_receive_message', savedMsg);
      } catch (err) {
        console.error('Temp room message error:', err);
      }
    });

    // 9. WebRTC 1-to-1 Audio & Video Calling Handlers
    socket.on('call:initiate', async ({ targetUserId, conversationId, callType = 'audio' }, callback) => {
      try {
        const callerId = socket.user._id.toString();
        const targetIdStr = targetUserId ? targetUserId.toString() : null;

        if (!targetIdStr || targetIdStr === callerId) {
          if (typeof callback === 'function') callback({ success: false, message: 'Invalid target user' });
          return;
        }

        // Security check: Block verification
        const isBlocked = await Block.isBlocked(callerId, targetIdStr);
        if (isBlocked) {
          socket.emit('call:error', { message: 'Cannot call: communication with this user is blocked.' });
          if (typeof callback === 'function') callback({ success: false, message: 'User is blocked' });
          return;
        }

        // Connection check: Both users must be mutual contacts
        const isConnected = await Connection.areUsersConnected(callerId, targetIdStr);
        if (!isConnected) {
          socket.emit('call:error', { message: 'Cannot call: you must be mutual contacts to call.' });
          if (typeof callback === 'function') callback({ success: false, message: 'Not connected' });
          return;
        }

        // Check if caller is already in a call
        if (userActiveCall.has(callerId)) {
          socket.emit('call:error', { message: 'You already have an active call in progress.' });
          if (typeof callback === 'function') callback({ success: false, message: 'Caller busy' });
          return;
        }

        // Check if target user is online
        const isTargetOnline = onlineUsers.has(targetIdStr) && onlineUsers.get(targetIdStr).size > 0;
        if (!isTargetOnline) {
          const unavailCall = await Call.create({
            conversationId,
            caller: callerId,
            receiver: targetIdStr,
            callType,
            status: 'unavailable',
            startedAt: new Date(),
            endedAt: new Date(),
            duration: 0
          });
          await recordCallMessage(unavailCall, io);
          socket.emit('call:unavailable', { targetUserId: targetIdStr, message: 'User is currently offline' });
          if (typeof callback === 'function') callback({ success: false, status: 'unavailable', message: 'User is offline' });
          return;
        }

        // Check if target user is already in a call
        if (userActiveCall.has(targetIdStr)) {
          const busyCall = await Call.create({
            conversationId,
            caller: callerId,
            receiver: targetIdStr,
            callType,
            status: 'busy',
            startedAt: new Date(),
            endedAt: new Date(),
            duration: 0
          });
          await recordCallMessage(busyCall, io);
          socket.emit('call:busy', { targetUserId: targetIdStr, message: 'User is currently busy on another call' });
          if (typeof callback === 'function') callback({ success: false, status: 'busy', message: 'User busy' });
          return;
        }

        // Create new Call record
        const call = await Call.create({
          conversationId,
          caller: callerId,
          receiver: targetIdStr,
          callType,
          status: 'initiated',
          startedAt: new Date()
        });

        const callId = call._id.toString();

        // 45-second auto-timeout if not answered
        const timeoutTimer = setTimeout(async () => {
          if (activeCalls.has(callId)) {
            const currentActive = activeCalls.get(callId);
            if (currentActive.status === 'initiated' || currentActive.status === 'ringing') {
              activeCalls.delete(callId);
              userActiveCall.delete(callerId);
              userActiveCall.delete(targetIdStr);

              call.status = 'missed';
              call.endedAt = new Date();
              call.duration = 0;
              await call.save();

              await recordCallMessage(call, io);

              io.to(`user:${callerId}`).emit('call:timeout', { callId });
              io.to(`user:${targetIdStr}`).emit('call:timeout', { callId });
            }
          }
        }, 45000);

        // Store active call state
        activeCalls.set(callId, {
          callId,
          callerId,
          receiverId: targetIdStr,
          conversationId,
          callType,
          status: 'initiated',
          startedAt: new Date(),
          timeoutTimer
        });

        userActiveCall.set(callerId, callId);
        userActiveCall.set(targetIdStr, callId);

        // Send incoming call notification to recipient
        io.to(`user:${targetIdStr}`).emit('call:incoming', {
          callId,
          conversationId,
          callType,
          caller: {
            _id: socket.user._id,
            name: socket.user.name,
            username: socket.user.username,
            avatar: socket.user.avatar
          }
        });

        // Notify caller that call is initiated
        socket.emit('call:initiated', {
          callId,
          conversationId,
          callType,
          targetUserId: targetIdStr
        });

        if (typeof callback === 'function') callback({ success: true, callId });
      } catch (err) {
        console.error('call:initiate error:', err);
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    socket.on('call:ringing', ({ callId }) => {
      if (callId && activeCalls.has(callId)) {
        const active = activeCalls.get(callId);
        if (active.status === 'initiated') {
          active.status = 'ringing';
          Call.findByIdAndUpdate(callId, { status: 'ringing' }).catch(console.error);
          io.to(`user:${active.callerId}`).emit('call:ringing', { callId });
        }
      }
    });

    socket.on('call:accept', async ({ callId }, callback) => {
      try {
        if (!callId || !activeCalls.has(callId)) {
          if (typeof callback === 'function') callback({ success: false, message: 'Call not found or expired' });
          return;
        }

        const active = activeCalls.get(callId);
        if (active.receiverId !== socket.user._id.toString()) {
          if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized' });
          return;
        }

        if (active.timeoutTimer) {
          clearTimeout(active.timeoutTimer);
          active.timeoutTimer = null;
        }

        const connectedAt = new Date();
        active.status = 'connected';
        active.connectedAt = connectedAt;

        await Call.findByIdAndUpdate(callId, { status: 'connected', connectedAt });

        io.to(`user:${active.callerId}`).emit('call:accepted', { callId, connectedAt });
        io.to(`user:${active.receiverId}`).emit('call:accepted', { callId, connectedAt });

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        console.error('call:accept error:', err);
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    socket.on('call:reject', async ({ callId, reason = 'declined' }) => {
      try {
        if (!callId || !activeCalls.has(callId)) return;
        const active = activeCalls.get(callId);

        if (active.timeoutTimer) {
          clearTimeout(active.timeoutTimer);
          active.timeoutTimer = null;
        }

        activeCalls.delete(callId);
        userActiveCall.delete(active.callerId);
        userActiveCall.delete(active.receiverId);

        const call = await Call.findById(callId);
        if (call) {
          call.status = reason === 'busy' ? 'busy' : 'declined';
          call.endedAt = new Date();
          call.duration = 0;
          await call.save();
          await recordCallMessage(call, io);
        }

        io.to(`user:${active.callerId}`).emit('call:rejected', { callId, reason });
      } catch (err) {
        console.error('call:reject error:', err);
      }
    });

    socket.on('call:cancel', async ({ callId }) => {
      try {
        if (!callId || !activeCalls.has(callId)) return;
        const active = activeCalls.get(callId);

        if (active.callerId !== socket.user._id.toString()) return;

        if (active.timeoutTimer) {
          clearTimeout(active.timeoutTimer);
          active.timeoutTimer = null;
        }

        activeCalls.delete(callId);
        userActiveCall.delete(active.callerId);
        userActiveCall.delete(active.receiverId);

        const call = await Call.findById(callId);
        if (call) {
          call.status = 'cancelled';
          call.endedAt = new Date();
          call.duration = 0;
          await call.save();
          await recordCallMessage(call, io);
        }

        io.to(`user:${active.receiverId}`).emit('call:cancelled', { callId });
      } catch (err) {
        console.error('call:cancel error:', err);
      }
    });

    socket.on('call:signal', ({ callId, targetUserId, signal }) => {
      if (!callId || !targetUserId || !signal) return;
      io.to(`user:${targetUserId}`).emit('call:signal', {
        callId,
        senderId: socket.user._id.toString(),
        signal
      });
    });

    socket.on('call:end', async ({ callId, duration = 0 }) => {
      try {
        if (!callId || !activeCalls.has(callId)) return;
        const active = activeCalls.get(callId);

        if (active.timeoutTimer) {
          clearTimeout(active.timeoutTimer);
          active.timeoutTimer = null;
        }

        activeCalls.delete(callId);
        userActiveCall.delete(active.callerId);
        userActiveCall.delete(active.receiverId);

        let finalDuration = duration;
        if (!finalDuration && active.connectedAt) {
          finalDuration = Math.max(0, Math.round((Date.now() - new Date(active.connectedAt).getTime()) / 1000));
        }

        const call = await Call.findById(callId);
        if (call) {
          call.status = 'ended';
          call.endedAt = new Date();
          call.duration = finalDuration;
          await call.save();
          await recordCallMessage(call, io);
        }

        io.to(`user:${active.callerId}`).emit('call:ended', { callId, duration: finalDuration });
        io.to(`user:${active.receiverId}`).emit('call:ended', { callId, duration: finalDuration });
      } catch (err) {
        console.error('call:end error:', err);
      }
    });

    // 10. Disconnection & Cleanup
    socket.on('disconnect', async () => {
      // Clean up active call on disconnect
      if (userActiveCall.has(userId)) {
        const callId = userActiveCall.get(userId);
        if (activeCalls.has(callId)) {
          const active = activeCalls.get(callId);

          if (active.timeoutTimer) {
            clearTimeout(active.timeoutTimer);
            active.timeoutTimer = null;
          }

          activeCalls.delete(callId);
          userActiveCall.delete(active.callerId);
          userActiveCall.delete(active.receiverId);

          const peerId = active.callerId === userId ? active.receiverId : active.callerId;
          const isConnected = active.status === 'connected';

          try {
            const call = await Call.findById(callId);
            if (call) {
              if (isConnected) {
                const dur = active.connectedAt
                  ? Math.max(0, Math.round((Date.now() - new Date(active.connectedAt).getTime()) / 1000))
                  : 0;
                call.status = 'ended';
                call.endedAt = new Date();
                call.duration = dur;
                await call.save();
                await recordCallMessage(call, io);
                io.to(`user:${peerId}`).emit('call:ended', { callId, duration: dur, reason: 'peer_disconnected' });
              } else {
                call.status = active.callerId === userId ? 'cancelled' : 'unavailable';
                call.endedAt = new Date();
                call.duration = 0;
                await call.save();
                await recordCallMessage(call, io);
                io.to(`user:${peerId}`).emit('call:cancelled', { callId, reason: 'peer_disconnected' });
              }
            }
          } catch (err) {
            console.error('Disconnect call cleanup error:', err);
          }
        }
      }

      if (onlineUsers.has(userId)) {
        const userSockets = onlineUsers.get(userId);
        userSockets.delete(socket.id);

        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen
          });
          io.emit('user_offline', { userId, lastSeen });
        }
      }
    });
  });
};

module.exports = initSocketHandlers;
