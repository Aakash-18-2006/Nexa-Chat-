const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Create a new group
// @route   POST /api/groups
const createGroup = async (req, res) => {
  try {
    const { name, description, avatar, memberIds = [] } = req.body;
    const currentUserId = req.user._id;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }

    // Combine current user with invited members and eliminate duplicates
    const uniqueParticipants = Array.from(
      new Set([currentUserId.toString(), ...memberIds.map((id) => id.toString())])
    );

    if (uniqueParticipants.length < 2) {
      return res.status(400).json({ success: false, message: 'A group requires at least 2 members' });
    }

    const defaultAvatar =
      avatar ||
      `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}&backgroundColor=4f46e5,7c3aed`;

    const group = await Conversation.create({
      type: 'group',
      participants: uniqueParticipants,
      groupInfo: {
        name: name.trim(),
        description: description ? description.trim() : '',
        avatar: defaultAvatar,
        adminIds: [currentUserId],
        createdBy: currentUserId
      }
    });

    // Create a system message announcing group creation
    const systemMsg = await Message.create({
      conversation: group._id,
      sender: currentUserId,
      content: `${req.user.name} created group "${name}"`,
      type: 'system'
    });

    group.lastMessage = systemMsg._id;
    await group.save();

    const populatedGroup = await Conversation.findById(group._id)
      .populate('participants', 'name username avatar isOnline lastSeen')
      .populate('groupInfo.adminIds', 'name username avatar')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name username avatar' }
      });

    return res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group: populatedGroup
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update group information (name, description, avatar)
// @route   PUT /api/groups/:id
const updateGroup = async (req, res) => {
  try {
    const { name, description, avatar } = req.body;
    const group = await Conversation.findOne({
      _id: req.params.id,
      type: 'group',
      participants: req.user._id
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found or unauthorized' });
    }

    if (name) group.groupInfo.name = name.trim();
    if (description !== undefined) group.groupInfo.description = description.trim();
    if (avatar) group.groupInfo.avatar = avatar;

    await group.save();

    const updated = await Conversation.findById(group._id)
      .populate('participants', 'name username avatar isOnline lastSeen')
      .populate('groupInfo.adminIds', 'name username avatar');

    return res.status(200).json({
      success: true,
      message: 'Group updated successfully',
      group: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add members to group
// @route   POST /api/groups/:id/members
const addMembers = async (req, res) => {
  try {
    const { memberIds = [] } = req.body;
    const group = await Conversation.findOne({
      _id: req.params.id,
      type: 'group',
      participants: req.user._id
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const currentParticipants = group.participants.map((p) => p.toString());
    const newMembers = memberIds.filter((mId) => !currentParticipants.includes(mId.toString()));

    if (newMembers.length === 0) {
      return res.status(400).json({ success: false, message: 'Specified users are already in the group' });
    }

    group.participants.push(...newMembers);
    await group.save();

    // System message
    const addedUsers = await User.find({ _id: { $in: newMembers } }).select('name');
    const names = addedUsers.map((u) => u.name).join(', ');
    await Message.create({
      conversation: group._id,
      sender: req.user._id,
      content: `${req.user.name} added ${names} to the group`,
      type: 'system'
    });

    const updated = await Conversation.findById(group._id)
      .populate('participants', 'name username avatar isOnline lastSeen')
      .populate('groupInfo.adminIds', 'name username avatar');

    return res.status(200).json({
      success: true,
      message: 'Members added successfully',
      group: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove member from group (Admins only)
// @route   DELETE /api/groups/:id/members/:memberId
const removeMember = async (req, res) => {
  try {
    const { id } = req.params;
    const memberId = req.params.memberId || req.params.userId;
    const group = await Conversation.findOne({ _id: id, type: 'group' });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const isAdmin = group.groupInfo.adminIds.some((adminId) => adminId.toString() === req.user._id.toString());
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Only group admins can remove members' });
    }

    group.participants = group.participants.filter((p) => p.toString() !== memberId);
    group.groupInfo.adminIds = group.groupInfo.adminIds.filter((a) => a.toString() !== memberId);
    await group.save();

    const removedUser = await User.findById(memberId).select('name');
    if (removedUser) {
      await Message.create({
        conversation: group._id,
        sender: req.user._id,
        content: `${req.user.name} removed ${removedUser.name} from the group`,
        type: 'system'
      });
    }

    const updated = await Conversation.findById(group._id)
      .populate('participants', 'name username avatar isOnline lastSeen')
      .populate('groupInfo.adminIds', 'name username avatar');

    return res.status(200).json({
      success: true,
      message: 'Member removed successfully',
      group: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Leave group
// @route   POST /api/groups/:id/leave
const leaveGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Conversation.findOne({ _id: id, type: 'group', participants: req.user._id });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found or you are not a member' });
    }

    group.participants = group.participants.filter((p) => p.toString() !== req.user._id.toString());
    group.groupInfo.adminIds = group.groupInfo.adminIds.filter((a) => a.toString() !== req.user._id.toString());

    // If no admins left and members exist, assign the first member as admin
    if (group.groupInfo.adminIds.length === 0 && group.participants.length > 0) {
      group.groupInfo.adminIds.push(group.participants[0]);
    }

    await group.save();

    await Message.create({
      conversation: group._id,
      sender: req.user._id,
      content: `${req.user.name} left the group`,
      type: 'system'
    });

    return res.status(200).json({
      success: true,
      message: 'You have left the group'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Assign or remove admin role
// @route   PUT /api/groups/:id/admins
const toggleAdmin = async (req, res) => {
  try {
    const { memberId, action } = req.body; // action: 'promote' | 'demote'
    const group = await Conversation.findOne({ _id: req.params.id, type: 'group' });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const isCurrentAdmin = group.groupInfo.adminIds.some((a) => a.toString() === req.user._id.toString());
    if (!isCurrentAdmin) {
      return res.status(403).json({ success: false, message: 'Only admins can manage roles' });
    }

    if (action === 'promote') {
      if (!group.groupInfo.adminIds.map((a) => a.toString()).includes(memberId)) {
        group.groupInfo.adminIds.push(memberId);
      }
    } else if (action === 'demote') {
      group.groupInfo.adminIds = group.groupInfo.adminIds.filter((a) => a.toString() !== memberId);
    }

    await group.save();

    const updated = await Conversation.findById(group._id)
      .populate('participants', 'name username avatar isOnline lastSeen')
      .populate('groupInfo.adminIds', 'name username avatar');

    return res.status(200).json({
      success: true,
      message: `User ${action === 'promote' ? 'promoted to admin' : 'demoted'} successfully`,
      group: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createGroup,
  updateGroup,
  addMembers,
  removeMember,
  leaveGroup,
  toggleAdmin
};
