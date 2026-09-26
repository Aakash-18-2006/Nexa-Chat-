const Notification = require('../models/Notification');

// @desc    Get user notifications
// @route   GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'name username avatar')
      .populate('conversation', 'type groupInfo')
      .populate('followRequest')
      .sort({ createdAt: -1 })
      .limit(40);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });

    const Connection = require('../models/Connection');
    const senderIds = notifications
      .map((n) => n.sender?._id)
      .filter(Boolean);
    const myFollowings = await Connection.find({
      follower: req.user._id,
      following: { $in: senderIds }
    });
    const followedSenderIds = new Set(myFollowings.map((c) => c.following.toString()));

    const enrichedNotifications = notifications.map((n) => {
      const nObj = n.toObject();
      if (n.sender && n.sender._id) {
        nObj.iFollowSender = followedSenderIds.has(n.sender._id.toString());
      }
      return nObj;
    });

    return res.status(200).json({
      success: true,
      unreadCount,
      notifications: enrichedNotifications
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
const markNotificationRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true }
    );
    return res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true }
    );
    return res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id
    });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return res.status(200).json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear all notifications for user
// @route   DELETE /api/notifications/clear-all
const clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    return res.status(200).json({ success: true, message: 'All notifications cleared successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllRead,
  deleteNotification,
  clearAllNotifications
};
