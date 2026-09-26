const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

const BASE_URL = 'http://localhost:5000/api';

const api = async (endpoint, options = {}, token = null) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
};

const runTests = async () => {
  console.log('====================================================');
  console.log('  TESTING CHAT CONTEXT-MENU PIN & DELETE BACKEND');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexa';
  await mongoose.connect(mongoUri);

  const ts = Date.now();
  const userAData = {
    name: 'Context User A',
    username: `ctx_a_${ts}`,
    email: `ctx_a_${ts}@example.com`,
    password: 'password123'
  };

  const userBData = {
    name: 'Context User B',
    username: `ctx_b_${ts}`,
    email: `ctx_b_${ts}@example.com`,
    password: 'password123'
  };

  const userCData = {
    name: 'Context User C',
    username: `ctx_c_${ts}`,
    email: `ctx_c_${ts}@example.com`,
    password: 'password123'
  };

  let tokenA, tokenB, tokenC;
  let userA, userB, userC;
  let convAB_id, convAC_id;

  try {
    // 1. Register users and establish connections
    console.log('[1] Registering test users...');
    const resA = await api('/auth/register', { method: 'POST', body: userAData });
    tokenA = resA.data.token;
    userA = resA.data.user;

    const resB = await api('/auth/register', { method: 'POST', body: userBData });
    tokenB = resB.data.token;
    userB = resB.data.user;

    const resC = await api('/auth/register', { method: 'POST', body: userCData });
    tokenC = resC.data.token;
    userC = resC.data.user;

    // Connect User A <-> User B
    const reqAB = await api('/follow/request', { method: 'POST', body: { targetUserId: userB._id } }, tokenA);
    await api(`/follow/request/${reqAB.data.requestId}/accept`, { method: 'POST' }, tokenB);

    // Connect User A <-> User C
    const reqAC = await api('/follow/request', { method: 'POST', body: { targetUserId: userC._id } }, tokenA);
    await api(`/follow/request/${reqAC.data.requestId}/accept`, { method: 'POST' }, tokenC);

    // Create conversations
    const convAB = await api('/conversations/direct', { method: 'POST', body: { participantId: userB._id } }, tokenA);
    convAB_id = convAB.data.conversation._id;

    const convAC = await api('/conversations/direct', { method: 'POST', body: { participantId: userC._id } }, tokenA);
    convAC_id = convAC.data.conversation._id;

    console.log('  ✓ Registered users and created 2 connected conversations\n');

    // 2. Test Pin Conversation
    console.log('[2] Testing Pin / Unpin Conversation...');
    const pinRes = await api(`/conversations/${convAB_id}/pin`, { method: 'POST' }, tokenA);
    if (!pinRes.ok || !pinRes.data.isPinned) {
      throw new Error(`Pin conversation failed: ${JSON.stringify(pinRes.data)}`);
    }
    console.log('  ✓ PASS: Pinned conversation A<->B');

    // Verify pinned conversation appears first in list for User A
    const listResA = await api('/conversations', { method: 'GET' }, tokenA);
    if (listResA.data.conversations[0]._id !== convAB_id) {
      throw new Error('Pinned conversation should be first in list!');
    }
    console.log('  ✓ PASS: Pinned conversation sorted to top of chat list');

    // Verify it is NOT pinned for User B (per-user pin persistence)
    const listResB = await api('/conversations', { method: 'GET' }, tokenB);
    const convForB = listResB.data.conversations.find((c) => c._id === convAB_id);
    const isPinnedForB = convForB?.pinnedBy?.some((id) => (id._id || id) === userB._id);
    if (isPinnedForB) throw new Error('Conversation should not be pinned for User B');
    console.log('  ✓ PASS: Pin status is strictly per-user and does not affect User B');

    // Test Unpin
    const unpinRes = await api(`/conversations/${convAB_id}/pin`, { method: 'POST' }, tokenA);
    if (!unpinRes.ok || unpinRes.data.isPinned) {
      throw new Error(`Unpin conversation failed: ${JSON.stringify(unpinRes.data)}`);
    }
    console.log('  ✓ PASS: Unpinned conversation A<->B successfully\n');

    // 3. Test Single Delete Conversation for User A
    console.log('[3] Testing Single Conversation Deletion...');
    const delSingleRes = await api(`/conversations/${convAB_id}`, { method: 'DELETE' }, tokenA);
    if (!delSingleRes.ok) {
      throw new Error(`Single delete failed: ${JSON.stringify(delSingleRes.data)}`);
    }
    console.log('  ✓ PASS: User A deleted conversation A<->B from chat list');

    // Verify User A chat list does not have convAB
    const postDelListA = await api('/conversations', { method: 'GET' }, tokenA);
    const foundInA = postDelListA.data.conversations.some((c) => c._id === convAB_id);
    if (foundInA) throw new Error('Deleted conversation still appears in User A chat list!');
    console.log('  ✓ PASS: Conversation removed from User A chat list');

    // Verify User B STILL has convAB in their chat list (does not affect other user)
    const postDelListB = await api('/conversations', { method: 'GET' }, tokenB);
    const foundInB = postDelListB.data.conversations.some((c) => c._id === convAB_id);
    if (!foundInB) throw new Error('Conversation was incorrectly removed from User B chat list!');
    console.log('  ✓ PASS: User B still has conversation in their chat list (other user unaffected)\n');

    // 4. Test Multiple Conversation Deletion (Batch Delete in Select Mode)
    console.log('[4] Testing Multiple Conversation Deletion...');
    // Create new conversation between User A and User B again
    const newConvAB = await api('/conversations/direct', { method: 'POST', body: { participantId: userB._id } }, tokenA);
    const newConvAB_id = newConvAB.data.conversation._id;

    // User A now has newConvAB and convAC
    const delMultiRes = await api(
      '/conversations/delete-multiple',
      {
        method: 'POST',
        body: { conversationIds: [newConvAB_id, convAC_id] }
      },
      tokenA
    );

    if (!delMultiRes.ok || delMultiRes.data.deletedIds?.length !== 2) {
      throw new Error(`Multiple delete failed: ${JSON.stringify(delMultiRes.data)}`);
    }
    console.log('  ✓ PASS: User A batch-deleted 2 conversations');

    const emptyListA = await api('/conversations', { method: 'GET' }, tokenA);
    if (emptyListA.data.conversations.length !== 0) {
      throw new Error(`Expected 0 conversations for User A, got ${emptyListA.data.conversations.length}`);
    }
    console.log('  ✓ PASS: User A chat list is now clean (0 conversations)');

    // Verify User C still has convAC
    const listC = await api('/conversations', { method: 'GET' }, tokenC);
    if (!listC.data.conversations.some((c) => c._id === convAC_id)) {
      throw new Error('User C conversation was incorrectly affected!');
    }
    console.log('  ✓ PASS: User C still has their conversation intact\n');

    console.log('====================================================');
    console.log('  ALL CONTEXT-MENU PIN & DELETE TESTS PASSED! 🎉');
    console.log('====================================================\n');
  } finally {
    // Cleanup test data
    console.log('[5] Cleaning up test data from MongoDB...');
    try {
      const User = require('../models/User');
      const FollowRequest = require('../models/FollowRequest');
      const Connection = require('../models/Connection');
      const Conversation = require('../models/Conversation');
      const Message = require('../models/Message');
      const Notification = require('../models/Notification');

      const testUserIds = [userA?._id, userB?._id, userC?._id].filter(Boolean);
      if (testUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: testUserIds } });
        await FollowRequest.deleteMany({
          $or: [{ sender: { $in: testUserIds } }, { recipient: { $in: testUserIds } }]
        });
        await Connection.deleteMany({ users: { $in: testUserIds } });
        await Notification.deleteMany({
          $or: [{ sender: { $in: testUserIds } }, { recipient: { $in: testUserIds } }]
        });
        await Message.deleteMany({
          conversation: { $in: [convAB_id, convAC_id].filter(Boolean) }
        });
        await Conversation.deleteMany({
          _id: { $in: [convAB_id, convAC_id].filter(Boolean) }
        });
        console.log('  ✓ PASS: Cleanup completed successfully.');
      }
      await mongoose.disconnect();
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }
  }
};

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  });
