// Verification script for Block and Unfollow functionality
const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('--- Starting Block & Unfollow Verification Test ---');

  const ts = Date.now();
  const userAData = {
    name: 'Blocker User',
    username: `blocker_${ts}`,
    email: `blocker_${ts}@test.com`,
    password: 'Password123!'
  };
  const userBData = {
    name: 'Target User',
    username: `target_${ts}`,
    email: `target_${ts}@test.com`,
    password: 'Password123!'
  };

  // 1. Register User A
  const resA = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userAData)
  });
  const dataA = await resA.json();
  if (!dataA.success) throw new Error(`Register A failed: ${JSON.stringify(dataA)}`);
  const tokenA = dataA.token;
  const userA = dataA.user;
  console.log(`✓ Registered User A: @${userA.username} (${userA._id})`);

  // 2. Register User B
  const resB = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userBData)
  });
  const dataB = await resB.json();
  if (!dataB.success) throw new Error(`Register B failed: ${JSON.stringify(dataB)}`);
  const tokenB = dataB.token;
  const userB = dataB.user;
  console.log(`✓ Registered User B: @${userB.username} (${userB._id})`);

  // 3. User A sends follow request to User B
  const reqRes = await fetch(`${BASE_URL}/follow/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({ targetUserId: userB._id })
  });
  const reqData = await reqRes.json();
  if (!reqData.success) throw new Error(`Follow request failed: ${JSON.stringify(reqData)}`);
  const requestId = reqData.requestId;
  console.log(`✓ User A sent follow request to User B (Request ID: ${requestId})`);

  // 4. User B accepts follow request
  const acceptRes = await fetch(`${BASE_URL}/follow/request/${requestId}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenB}`
    }
  });
  const acceptData = await acceptRes.json();
  if (!acceptData.success) throw new Error(`Accept request failed: ${JSON.stringify(acceptData)}`);
  console.log(`✓ User B accepted follow request -> Connected!`);

  // 5. Open direct conversation & send message
  const convRes = await fetch(`${BASE_URL}/conversations/direct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({ participantId: userB._id })
  });
  const convData = await convRes.json();
  if (!convData.success) throw new Error(`Get direct conv failed: ${JSON.stringify(convData)}`);
  const convId = convData.conversation._id;
  console.log(`✓ Direct conversation opened: ${convId}`);

  const msgRes = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      conversationId: convId,
      content: 'Hello, testing connection before unfollow!'
    })
  });
  const msgData = await msgRes.json();
  if (!msgData.success) throw new Error(`Send message failed: ${JSON.stringify(msgData)}`);
  console.log(`✓ User A successfully sent message to User B while connected.`);

  // 6. Test UNFOLLOW: User A unfollows User B
  const unfollowRes = await fetch(`${BASE_URL}/follow/unfollow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({ targetUserId: userB._id })
  });
  const unfollowData = await unfollowRes.json();
  if (!unfollowData.success) throw new Error(`Unfollow failed: ${JSON.stringify(unfollowData)}`);
  console.log(`✓ User A unfollowed User B: status is now '${unfollowData.status}'`);

  // 7. Test messaging permission after unfollow (must be rejected with 403 NOT_CONNECTED)
  const postUnfollowMsgRes = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      conversationId: convId,
      content: 'Should fail because unconnected!'
    })
  });
  const postUnfollowMsgData = await postUnfollowMsgRes.json();
  if (postUnfollowMsgRes.status === 403 && postUnfollowMsgData.code === 'NOT_CONNECTED') {
    console.log(`✓ Security verified: Message rejected after unfollow with 403 NOT_CONNECTED.`);
  } else {
    throw new Error(`Expected 403 NOT_CONNECTED after unfollow, got: ${postUnfollowMsgRes.status} ${JSON.stringify(postUnfollowMsgData)}`);
  }

  // 8. Re-connect users for BLOCK test
  const reReqRes = await fetch(`${BASE_URL}/follow/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({ targetUserId: userB._id })
  });
  const reReqData = await reReqRes.json();
  const reRequestId = reReqData.requestId;

  await fetch(`${BASE_URL}/follow/request/${reRequestId}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenB}`
    }
  });
  console.log(`✓ Re-connected users for block verification.`);

  // 9. Test BLOCK: User A blocks User B
  const blockRes = await fetch(`${BASE_URL}/follow/block`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({ targetUserId: userB._id })
  });
  const blockData = await blockRes.json();
  if (!blockData.success || blockData.status !== 'blocked') {
    throw new Error(`Block failed: ${JSON.stringify(blockData)}`);
  }
  console.log(`✓ User A blocked User B successfully.`);

  // 10. Verify blocked messaging: User B tries to message User A -> rejected with 403 USER_BLOCKED
  const blockedMsgRes = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenB}`
    },
    body: JSON.stringify({
      conversationId: convId,
      content: 'Blocked message attempt from User B'
    })
  });
  const blockedMsgData = await blockedMsgRes.json();
  if (blockedMsgRes.status === 403 && blockedMsgData.code === 'USER_BLOCKED') {
    console.log(`✓ Security verified: Blocked message rejected with 403 USER_BLOCKED.`);
  } else {
    throw new Error(`Expected 403 USER_BLOCKED, got: ${blockedMsgRes.status} ${JSON.stringify(blockedMsgData)}`);
  }

  // 11. Verify blocked follow request: User B tries to follow User A -> rejected
  const blockedFollowRes = await fetch(`${BASE_URL}/follow/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenB}`
    },
    body: JSON.stringify({ targetUserId: userA._id })
  });
  const blockedFollowData = await blockedFollowRes.json();
  if (blockedFollowRes.status === 403 && blockedFollowData.code === 'USER_BLOCKED') {
    console.log(`✓ Security verified: Blocked follow request rejected with 403 USER_BLOCKED.`);
  } else {
    throw new Error(`Expected 403 USER_BLOCKED on follow request, got: ${blockedFollowRes.status} ${JSON.stringify(blockedFollowData)}`);
  }

  // 12. Verify profile status for blocked user
  const profileRes = await fetch(`${BASE_URL}/users/${userB._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const profileData = await profileRes.json();
  if (profileData.user.relationshipStatus === 'blocked' && profileData.user.isBlocker === true) {
    console.log(`✓ Profile check verified: User A sees User B as blocked (isBlocker=true).`);
  } else {
    throw new Error(`Profile check failed: ${JSON.stringify(profileData)}`);
  }

  // 13. Test UNBLOCK: User A unblocks User B
  const unblockRes = await fetch(`${BASE_URL}/follow/unblock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({ targetUserId: userB._id })
  });
  const unblockData = await unblockRes.json();
  if (!unblockData.success) throw new Error(`Unblock failed: ${JSON.stringify(unblockData)}`);
  console.log(`✓ User A unblocked User B.`);

  // 14. Verify relationship status after unblock
  const postUnblockStatusRes = await fetch(`${BASE_URL}/follow/status/${userB._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const postUnblockStatusData = await postUnblockStatusRes.json();
  if (postUnblockStatusData.status === 'none') {
    console.log(`✓ Status check verified: After unblock, relationship status is 'none'.`);
  } else {
    throw new Error(`Expected status 'none', got: ${JSON.stringify(postUnblockStatusData)}`);
  }

  console.log('\n=============================================');
  console.log(' ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('=============================================\n');
}

main().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
