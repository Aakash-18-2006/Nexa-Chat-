// Verification script for Blocked Accounts feature in Settings
const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('--- Starting Blocked Accounts Settings Verification ---');

  const ts = Date.now();
  const userAData = {
    name: 'User Alpha',
    username: `alpha_${ts}`,
    email: `alpha_${ts}@test.com`,
    password: 'Password123!'
  };
  const userBData = {
    name: 'User Beta',
    username: `beta_${ts}`,
    email: `beta_${ts}@test.com`,
    password: 'Password123!'
  };
  const userCData = {
    name: 'User Gamma',
    username: `gamma_${ts}`,
    email: `gamma_${ts}@test.com`,
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
  console.log(`✓ Registered User A: @${userA.username}`);

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
  console.log(`✓ Registered User B: @${userB.username}`);

  // 3. Register User C
  const resC = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userCData)
  });
  const dataC = await resC.json();
  if (!dataC.success) throw new Error(`Register C failed: ${JSON.stringify(dataC)}`);
  const userC = dataC.user;
  console.log(`✓ Registered User C: @${userC.username}`);

  // 4. Initial check: User A has 0 blocked accounts
  const initialRes = await fetch(`${BASE_URL}/follow/blocked`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const initialData = await initialRes.json();
  if (!initialData.success || initialData.blockedUsers.length !== 0) {
    throw new Error(`Expected 0 blocked users initially, got: ${JSON.stringify(initialData)}`);
  }
  console.log(`✓ Initial state verified: User A has 0 blocked accounts.`);

  // 5. User A blocks User B
  const blockBRes = await fetch(`${BASE_URL}/follow/block`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({ targetUserId: userB._id })
  });
  const blockBData = await blockBRes.json();
  if (!blockBData.success) throw new Error(`Block B failed: ${JSON.stringify(blockBData)}`);
  console.log(`✓ User A blocked User B.`);

  // 6. User A blocks User C
  const blockCRes = await fetch(`${BASE_URL}/follow/block`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({ targetUserId: userC._id })
  });
  const blockCData = await blockCRes.json();
  if (!blockCData.success) throw new Error(`Block C failed: ${JSON.stringify(blockCData)}`);
  console.log(`✓ User A blocked User C.`);

  // 7. User A fetches blocked accounts list (Settings -> Blocked Accounts)
  const listRes = await fetch(`${BASE_URL}/follow/blocked`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const listData = await listRes.json();
  if (!listData.success || listData.blockedUsers.length !== 2) {
    throw new Error(`Expected 2 blocked accounts, got: ${JSON.stringify(listData)}`);
  }

  const blockedUsernames = listData.blockedUsers.map((u) => u.username);
  if (!blockedUsernames.includes(userB.username) || !blockedUsernames.includes(userC.username)) {
    throw new Error(`Blocked list missing expected users: ${JSON.stringify(blockedUsernames)}`);
  }
  console.log(`✓ User A blocked list verified: contains @${userB.username} and @${userC.username}.`);

  // Verify safe public fields are returned
  const firstItem = listData.blockedUsers[0];
  if (!firstItem.name || !firstItem.username || !firstItem._id) {
    throw new Error(`Blocked item missing required fields: ${JSON.stringify(firstItem)}`);
  }
  console.log(`✓ Item fields verified: name="${firstItem.name}", username="${firstItem.username}".`);

  // 8. Security verification: User B cannot see User A's blocks
  const bListRes = await fetch(`${BASE_URL}/follow/blocked`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const bListData = await bListRes.json();
  if (!bListData.success || bListData.blockedUsers.length !== 0) {
    throw new Error(`Security breach: User B saw blocked accounts: ${JSON.stringify(bListData)}`);
  }
  console.log(`✓ Security verified: User B sees 0 blocked accounts (only blocker sees their blocks).`);

  // 9. User A unblocks User B
  const unblockBRes = await fetch(`${BASE_URL}/follow/unblock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({ targetUserId: userB._id })
  });
  const unblockBData = await unblockBRes.json();
  if (!unblockBData.success) throw new Error(`Unblock B failed: ${JSON.stringify(unblockBData)}`);
  console.log(`✓ User A unblocked User B.`);

  // 10. User A verifies User B was removed from blocked accounts list
  const postUnblockRes = await fetch(`${BASE_URL}/follow/blocked`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const postUnblockData = await postUnblockRes.json();
  if (postUnblockData.blockedUsers.length !== 1 || postUnblockData.blockedUsers[0].username !== userC.username) {
    throw new Error(`Expected only User C in list, got: ${JSON.stringify(postUnblockData)}`);
  }
  console.log(`✓ Verified User B immediately removed: only @${userC.username} remains.`);

  // 11. Persistence verification across new login session
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: userAData.email, password: userAData.password })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  const sessionToken = loginData.token;

  const persistRes = await fetch(`${BASE_URL}/follow/blocked`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
  const persistData = await persistRes.json();
  if (!persistData.success || !persistData.blockedUsers || persistData.blockedUsers.length !== 1 || persistData.blockedUsers[0].username !== userC.username) {
    throw new Error(`Persistence failure across sessions: ${JSON.stringify(persistData)}`);
  }
  console.log(`✓ Persistence verified: Blocked accounts list persists after re-login.`);

  // 12. Unblock User C -> clean empty state
  await fetch(`${BASE_URL}/follow/unblock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ targetUserId: userC._id })
  });

  const emptyRes = await fetch(`${BASE_URL}/follow/blocked`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
  const emptyData = await emptyRes.json();
  if (emptyData.blockedUsers.length !== 0) {
    throw new Error(`Expected empty list, got: ${JSON.stringify(emptyData)}`);
  }
  console.log(`✓ Clean empty state verified: User A has 0 blocked accounts.`);

  console.log('\n======================================================');
  console.log(' ALL BLOCKED ACCOUNTS SETTINGS TESTS PASSED! 🎉');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
