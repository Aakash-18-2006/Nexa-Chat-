// Verification script for Chat Info User Profile tab and real followers/following counts
const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('--- Starting Chat Info User Profile Verification ---');

  const ts = Date.now();
  const userAData = {
    name: 'Profile User A',
    username: `profa_${ts}`,
    email: `profa_${ts}@test.com`,
    password: 'Password123!'
  };
  const userBData = {
    name: 'Profile User B',
    username: `profb_${ts}`,
    email: `profb_${ts}@test.com`,
    password: 'Password123!'
  };
  const userCData = {
    name: 'Profile User C',
    username: `profc_${ts}`,
    email: `profc_${ts}@test.com`,
    password: 'Password123!'
  };

  // 1. Register users
  const resA = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userAData)
  });
  const dataA = await resA.json();
  const tokenA = dataA.token;
  const userA = dataA.user;
  console.log(`✓ Registered User A: @${userA.username}`);

  const resB = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userBData)
  });
  const dataB = await resB.json();
  const tokenB = dataB.token;
  const userB = dataB.user;
  console.log(`✓ Registered User B: @${userB.username}`);

  const resC = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userCData)
  });
  const dataC = await resC.json();
  const tokenC = dataC.token;
  const userC = dataC.user;
  console.log(`✓ Registered User C: @${userC.username}`);

  // 2. Initial state: User A checks User B profile
  const p1Res = await fetch(`${BASE_URL}/users/${userB._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const p1Data = await p1Res.json();
  if (!p1Data.success) throw new Error(`Fetch profile failed: ${JSON.stringify(p1Data)}`);

  console.log(`✓ Profile fields: name="${p1Data.user.name}", username="${p1Data.user.username}", avatar="${p1Data.user.avatar}"`);
  console.log(`✓ Initial counts: followers=${p1Data.user.followersCount}, following=${p1Data.user.followingCount}, status="${p1Data.user.relationshipStatus}"`);

  if (p1Data.user.followersCount !== 0 || p1Data.user.followingCount !== 0) {
    throw new Error(`Expected initial followers/following = 0`);
  }
  if (p1Data.user.relationshipStatus !== 'none') {
    throw new Error(`Expected initial status = none, got ${p1Data.user.relationshipStatus}`);
  }

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

  // Check state: User A sees 'pending_sent' ("Request Sent")
  const p2Res = await fetch(`${BASE_URL}/users/${userB._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const p2Data = await p2Res.json();
  if (p2Data.user.relationshipStatus !== 'pending_sent') {
    throw new Error(`Expected status 'pending_sent', got: ${p2Data.user.relationshipStatus}`);
  }
  console.log(`✓ User A status verified: relationshipStatus = 'pending_sent' ("Request Sent")`);

  // Check state: User B sees 'pending_received' ("Accept" / "Decline")
  const p2bRes = await fetch(`${BASE_URL}/users/${userA._id}`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const p2bData = await p2bRes.json();
  if (p2bData.user.relationshipStatus !== 'pending_received') {
    throw new Error(`Expected status 'pending_received', got: ${p2bData.user.relationshipStatus}`);
  }
  console.log(`✓ User B status verified: relationshipStatus = 'pending_received' ("Accept")`);

  // 4. User B accepts follow request
  const acceptRes = await fetch(`${BASE_URL}/follow/request/${requestId}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenB}`
    }
  });
  const acceptData = await acceptRes.json();
  if (!acceptData.success) throw new Error(`Accept failed: ${JSON.stringify(acceptData)}`);
  console.log(`✓ User B accepted follow request -> Connected!`);

  // 5. User A verifies User B's profile: connected + count updated
  const p3Res = await fetch(`${BASE_URL}/users/${userB._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const p3Data = await p3Res.json();
  if (p3Data.user.relationshipStatus !== 'connected') {
    throw new Error(`Expected status 'connected', got: ${p3Data.user.relationshipStatus}`);
  }
  if (p3Data.user.followersCount !== 1 || p3Data.user.followingCount !== 1) {
    throw new Error(`Expected followers=1, following=1, got: ${p3Data.user.followersCount}, ${p3Data.user.followingCount}`);
  }
  console.log(`✓ User B profile updated: status="connected" ("Message"), followers=${p3Data.user.followersCount}, following=${p3Data.user.followingCount}`);

  // 6. User C also connects with User B
  const reqCRes = await fetch(`${BASE_URL}/follow/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenC}`
    },
    body: JSON.stringify({ targetUserId: userB._id })
  });
  const reqCData = await reqCRes.json();
  await fetch(`${BASE_URL}/follow/request/${reqCData.requestId}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenB}`
    }
  });
  console.log(`✓ User C also connected with User B.`);

  // Verify User B now has 2 followers / following
  const p4Res = await fetch(`${BASE_URL}/users/${userB._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const p4Data = await p4Res.json();
  if (p4Data.user.followersCount !== 2 || p4Data.user.followingCount !== 2) {
    throw new Error(`Expected followers=2, following=2 for User B, got: ${p4Data.user.followersCount}, ${p4Data.user.followingCount}`);
  }
  console.log(`✓ User B counts dynamically updated to 2: followers=${p4Data.user.followersCount}, following=${p4Data.user.followingCount}`);

  // 7. User A unfollows User B
  await fetch(`${BASE_URL}/follow/unfollow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({ targetUserId: userB._id })
  });
  console.log(`✓ User A unfollowed User B.`);

  // Verify User B's count decrements to 1 and User A's status resets to 'none' ("Follow to Message")
  const p5Res = await fetch(`${BASE_URL}/users/${userB._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const p5Data = await p5Res.json();
  if (p5Data.user.relationshipStatus !== 'none') {
    throw new Error(`Expected status 'none' after unfollow, got: ${p5Data.user.relationshipStatus}`);
  }
  if (p5Data.user.followersCount !== 1) {
    throw new Error(`Expected User B followers=1 after A unfollowed, got: ${p5Data.user.followersCount}`);
  }
  console.log(`✓ After unfollow: User B followers=${p5Data.user.followersCount}, User A relationshipStatus='none' ("Follow to Message")`);

  // Verify User A's counts are now 0
  const pApostRes = await fetch(`${BASE_URL}/users/${userA._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const pApostData = await pApostRes.json();
  if (pApostData.user.followersCount !== 0 || pApostData.user.followingCount !== 0) {
    throw new Error(`Expected User A counts=0, got followers=${pApostData.user.followersCount}, following=${pApostData.user.followingCount}`);
  }
  console.log(`✓ User A counts after unfollow: followers=0, following=0`);

  // 8. User A blocks User B
  await fetch(`${BASE_URL}/follow/block`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({ targetUserId: userB._id })
  });
  console.log(`✓ User A blocked User B.`);

  const p6Res = await fetch(`${BASE_URL}/users/${userB._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const p6Data = await p6Res.json();
  if (p6Data.user.relationshipStatus !== 'blocked') {
    throw new Error(`Expected status 'blocked', got: ${p6Data.user.relationshipStatus}`);
  }
  console.log(`✓ User A sees User B relationshipStatus = 'blocked' ("Blocked")`);

  console.log('\n======================================================');
  console.log(' ALL CHAT INFO USER PROFILE TESTS PASSED! 🎉');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
