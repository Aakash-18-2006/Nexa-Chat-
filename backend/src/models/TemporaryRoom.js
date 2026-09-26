const mongoose = require('mongoose');

const tempMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    senderName: {
      type: String,
      required: true
    },
    senderAvatar: {
      type: String,
      default: ''
    },
    content: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['text', 'image', 'system'],
      default: 'text'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const temporaryRoomSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      default: 'Quick Room',
      trim: true,
      maxlength: 60
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        joinedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    messages: [tempMessageSchema],
    expiresAt: {
      type: Date,
      required: true
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// TTL index to automatically remove expired rooms from MongoDB
temporaryRoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TemporaryRoom = mongoose.model('TemporaryRoom', temporaryRoomSchema);
module.exports = TemporaryRoom;
