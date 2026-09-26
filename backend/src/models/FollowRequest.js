const mongoose = require('mongoose');

const followRequestSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'cancelled'],
      default: 'pending',
      index: true
    }
  },
  {
    timestamps: true
  }
);

followRequestSchema.index({ sender: 1, recipient: 1 });
followRequestSchema.index({ recipient: 1, status: 1 });

const FollowRequest = mongoose.model('FollowRequest', followRequestSchema);
module.exports = FollowRequest;
