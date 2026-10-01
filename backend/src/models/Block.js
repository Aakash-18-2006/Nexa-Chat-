const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Unique index to prevent duplicate block entries
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
blockSchema.index({ blocked: 1, blocker: 1 });

/**
 * Check if interaction between two users is blocked in either direction
 * @param {string|mongoose.Types.ObjectId} user1Id
 * @param {string|mongoose.Types.ObjectId} user2Id
 * @returns {Promise<boolean>}
 */
blockSchema.statics.isBlocked = async function (user1Id, user2Id) {
  if (!user1Id || !user2Id) return false;
  if (user1Id.toString() === user2Id.toString()) return false;

  const count = await this.countDocuments({
    $or: [
      { blocker: user1Id, blocked: user2Id },
      { blocker: user2Id, blocked: user1Id }
    ]
  });
  return count > 0;
};

const Block = mongoose.model('Block', blockSchema);
module.exports = Block;
