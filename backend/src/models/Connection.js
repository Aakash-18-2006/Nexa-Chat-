const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    connectedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index to guarantee no duplicate follows
connectionSchema.index({ follower: 1, following: 1 }, { unique: true });
connectionSchema.index({ users: 1 });

/**
 * Check if followerId follows followingId
 * @param {string|mongoose.Types.ObjectId} followerId
 * @param {string|mongoose.Types.ObjectId} followingId
 * @returns {Promise<boolean>}
 */
connectionSchema.statics.isFollowing = async function (followerId, followingId) {
  if (!followerId || !followingId) return false;
  if (followerId.toString() === followingId.toString()) return false;

  const count = await this.countDocuments({
    follower: followerId,
    following: followingId
  });
  return count > 0;
};

/**
 * Check if two users are connected in either direction for messaging permissions
 * (User A follows B OR User B follows A)
 * @param {string|mongoose.Types.ObjectId} user1Id
 * @param {string|mongoose.Types.ObjectId} user2Id
 * @returns {Promise<boolean>}
 */
connectionSchema.statics.areUsersConnected = async function (user1Id, user2Id) {
  if (!user1Id || !user2Id) return false;
  if (user1Id.toString() === user2Id.toString()) return false;

  const count = await this.countDocuments({
    $or: [
      { follower: user1Id, following: user2Id },
      { follower: user2Id, following: user1Id },
      { users: { $all: [user1Id, user2Id], $size: 2 } }
    ]
  });
  return count > 0;
};

/**
 * Get follower count for a user (users following this user)
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<number>}
 */
connectionSchema.statics.getFollowersCount = async function (userId) {
  if (!userId) return 0;
  return this.countDocuments({ following: userId });
};

/**
 * Get following count for a user (users this user follows)
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<number>}
 */
connectionSchema.statics.getFollowingCount = async function (userId) {
  if (!userId) return 0;
  return this.countDocuments({ follower: userId });
};

const Connection = mongoose.model('Connection', connectionSchema);
module.exports = Connection;
