// Comprehensive test for My Profile & Other Profile Followers and Following navigation & data
const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('--- Testing Profile Followers & Following API & Navigation ---');
  const ts = Date.now();

  // 1. Create User A (My Profile)
  const regARes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alice Owner',
      username: `alice_${ts}`,
      email: `alice_${ts}@test.com`,
      password: 'password123'
    })
  });
  const dataA = await regARes.json();
  const userA = dataA.user;
  const tokenA = dataA.token;

  // 2. Create User B (Follower of Alice)
  const regBRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bob Follower',
      username: `bob_${ts}`,
      email: `bob_${ts}@test.com`,
      password: 'password123'
    })
  });
  const dataB = await regBRes.json();
  const userB = dataB.user;
  const tokenB = dataB.token;

  // 3. Create User C (Alice follows Charlie)
  const regCRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Charlie Followed',
      username: `charlie_${ts}`,
      email: `charlie_${ts}@test.com`,
      password: 'password123'
    })
  });
  const dataC = await regCRes.json();
  const userC = dataC.user;
  const tokenC = dataC.token;

  // Bob requests to follow Alice -> Alice accepts
  const reqBA = await fetch(`${BASE_URL}/follow/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ targetUserId: userA._id })
  });
  const dataBA = await reqBA.json();
  await fetch(`${BASE_URL}/follow/request/${dataBA.requestId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` }
  });

  // Alice requests to follow Charlie -> Charlie accepts
  const reqAC = await fetch(`${BASE_URL}/follow/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ targetUserId: userC._id })
  });
  const dataAC = await reqAC.json();
  await fetch(`${BASE_URL}/follow/request/${dataAC.requestId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenC}` }
  });

  // Case 1: My Profile as Alice -> Followers
  console.log('\nTesting Case 1: Alice (My Profile) -> Followers');
  const aFollowersRes = await fetch(`${BASE_URL}/follow/users/${userA._id}/followers`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const aFollowersData = await aFollowersRes.json();
  console.log(`Followers of Alice: ${aFollowersData.users.length}`);
  if (aFollowersData.users.length !== 1 || aFollowersData.users[0].username !== userB.username) {
    throw new Error('Case 1 Failed: Expected Bob in Alice followers');
  }
  console.log(`✓ Case 1 Passed: Alice sees Bob in Followers list with relationship '${aFollowersData.users[0].relationshipStatus}'`);

  // Case 2: My Profile as Alice -> Following
  console.log('\nTesting Case 2: Alice (My Profile) -> Following');
  const aFollowingRes = await fetch(`${BASE_URL}/follow/users/${userA._id}/following`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const aFollowingData = await aFollowingRes.json();
  console.log(`Following of Alice: ${aFollowingData.users.length}`);
  if (aFollowingData.users.length !== 1 || aFollowingData.users[0].username !== userC.username) {
    throw new Error('Case 2 Failed: Expected Charlie in Alice following');
  }
  if (aFollowingData.users[0].relationshipStatus !== 'following') {
    throw new Error(`Case 2 Failed: Expected Charlie relationship 'following', got: ${aFollowingData.users[0].relationshipStatus}`);
  }
  console.log(`✓ Case 2 Passed: Alice sees Charlie in Following list with relationship '${aFollowingData.users[0].relationshipStatus}'`);

  // Case 3: Other User Profile (Bob viewing Alice's Followers)
  console.log('\nTesting Case 3: Bob (Other Profile) -> Alice Followers');
  const bViewAFollowersRes = await fetch(`${BASE_URL}/follow/users/${userA._id}/followers`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const bViewAFollowersData = await bViewAFollowersRes.json();
  if (bViewAFollowersData.users.length !== 1) {
    throw new Error('Case 3 Failed');
  }
  console.log(`✓ Case 3 Passed: Bob sees Alice followers with relationship '${bViewAFollowersData.users[0].relationshipStatus}'`);

  // Case 4: Other User Profile (Bob viewing Alice's Following)
  console.log('\nTesting Case 4: Bob (Other Profile) -> Alice Following');
  const bViewAFollowingRes = await fetch(`${BASE_URL}/follow/users/${userA._id}/following`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const bViewAFollowingData = await bViewAFollowingRes.json();
  if (bViewAFollowingData.users.length !== 1 || bViewAFollowingData.users[0].username !== userC.username) {
    throw new Error('Case 4 Failed');
  }
  console.log(`✓ Case 4 Passed: Bob sees Alice following Charlie with relationship '${bViewAFollowingData.users[0].relationshipStatus}'`);

  console.log('\n ALL 4 CASES PASSED SUCCESSFULLY! 🎉');
}

main().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
