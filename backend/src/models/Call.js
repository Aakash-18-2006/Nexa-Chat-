const mongoose = require('mongoose');

const callSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    },
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    callType: {
      type: String,
      enum: ['audio', 'video'],
      default: 'audio',
      required: true
    },
    status: {
      type: String,
      enum: [
        'initiated',
        'ringing',
        'connected',
        'ended',
        'declined',
        'missed',
        'busy',
        'failed',
        'cancelled',
        'unavailable'
      ],
      default: 'initiated',
      index: true
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    connectedAt: {
      type: Date
    },
    endedAt: {
      type: Date
    },
    duration: {
      type: Number,
      default: 0 // Duration in seconds
    }
  },
  {
    timestamps: true
  }
);

callSchema.pre('save', function (next) {
  if (this.conversationId && !this.conversation) {
    this.conversation = this.conversationId;
  }
  if (this.conversation && !this.conversationId) {
    this.conversationId = this.conversation;
  }
  next();
});

callSchema.index({ conversationId: 1, createdAt: -1 });
callSchema.index({ caller: 1, receiver: 1, createdAt: -1 });

const Call = mongoose.model('Call', callSchema);
module.exports = Call;
