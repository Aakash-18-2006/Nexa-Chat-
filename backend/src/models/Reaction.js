const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  emoji: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

reactionSchema.index({ messageId: 1, userId: 1, emoji: 1 }, { unique: true });

module.exports = mongoose.model('Reaction', reactionSchema);
