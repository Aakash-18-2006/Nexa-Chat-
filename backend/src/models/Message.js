const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    emoji: {
      type: String,
      required: true
    }
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true
    },
    name: {
      type: String,
      default: 'attachment'
    },
    size: {
      type: Number,
      default: 0
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream'
    },
    duration: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      index: true
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      index: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    content: {
      type: String,
      trim: true,
      default: ''
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'system', 'call'],
      default: 'text'
    },
    callDetails: {
      callId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Call'
      },
      callType: {
        type: String,
        enum: ['audio', 'video'],
        default: 'audio'
      },
      status: {
        type: String,
        enum: ['ended', 'missed', 'declined', 'cancelled', 'failed', 'busy', 'unavailable'],
        default: 'ended'
      },
      duration: {
        type: Number,
        default: 0
      }
    },
    attachments: [attachmentSchema],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },
    reactions: [reactionSchema],
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        readAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    deliveredTo: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        deliveredAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    edited: {
      type: Boolean,
      default: false
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    deleted: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    isPinned: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Pre-save synchronization hook between conversation/conversationId and sender/senderId
messageSchema.pre('save', function (next) {
  if (this.conversation && !this.conversationId) this.conversationId = this.conversation;
  if (this.conversationId && !this.conversation) this.conversation = this.conversationId;
  if (this.sender && !this.senderId) this.senderId = this.sender;
  if (this.senderId && !this.sender) this.sender = this.senderId;
  if (this.edited) this.isEdited = true;
  if (this.isEdited) this.edited = true;
  if (this.deleted) this.isDeleted = true;
  if (this.isDeleted) this.deleted = true;
  next();
});

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, 'readBy.user': 1 });
messageSchema.index({ content: 'text' });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
