// Verification script for Followers & Following list endpoints and relationship calculations
const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('--- Starting Followers & Following List Verification ---');

  const ts = Date.now();
  const userAData = {
    name: 'Alice List',
    username: `alice_list_${ts}`,
    email: `alice_list_${ts}@test.com`,
    password: 'Password123!'
  };
  const userBData = {
    name: 'Bob List',
    username: `bob_list_${ts}`,
    email: `bob_list_${ts}@test.com`,
    password: 'Password123!'
  };
  const userCData = {
    name: 'Charlie List',
    username: `charlie_list_${ts}`,
    email: `charlie_list_${ts}@test.com`,
    password: 'Password123!'
  };
  const userDData = {
    name: 'David List',
    username: `david_list_${ts}`,
    email: `david_list_${ts}@test.com`,
    password: 'Password123!'
  };

  // 1. Register users
  const regUser = async (data) => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return { token: json.token, user: json.user };
  };

  const { token: tokenA, user: userA } = await regUser(userAData);
  const { token: tokenB, user: userB } = await regUser(userBData);
  const { token: tokenC, user: userC } = await regUser(userCData);
  const { token: tokenD, user: userD } = await regUser(userDData);

  console.log(`✓ Registered 4 test users: Alice, Bob, Charlie, David.`);

  // 2. Initial state: Bob has 0 followers and 0 following
  const initFollowersRes = await fetch(`${BASE_URL}/follow/users/${userB._id}/followers`, {
    headers: { Authorization: `Bearer ${tokenD}` }
  });
  const initFollowersData = await initFollowersRes.json();
  if (!initFollowersData.success || initFollowersData.users.length !== 0) {
    throw new Error(`Expected 0 initial followers for Bob, got: ${JSON.stringify(initFollowersData)}`);
  }

  const initFollowingRes = await fetch(`${BASE_URL}/follow/users/${userB._id}/following`, {
    headers: { Authorization: `Bearer ${tokenD}` }
  });
  const initFollowingData = await initFollowingRes.json();
  if (!initFollowingData.success || initFollowingData.users.length !== 0) {
    throw new Error(`Expected 0 initial following for Bob, got: ${JSON.stringify(initFollowingData)}`);
  }
  console.log(`✓ Initial state verified: Bob has 0 followers and 0 following.`);

  // 3. Alice connects with Bob
  const reqABRes = await fetch(`${BASE_URL}/follow/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ targetUserId: userB._id })
  });
  const reqABData = await reqABRes.json();
  await fetch(`${BASE_URL}/follow/request/${reqABData.requestId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` }
  });
  console.log(`✓ Alice connected with Bob.`);

  // 4. Charlie connects with Bob
  const reqCBRes = await fetch(`${BASE_URL}/follow/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenC}` },
    body: JSON.stringify({ targetUserId: userB._id })
  });
  const reqCBData = await reqCBRes.json();
  await fetch(`${BASE_URL}/follow/request/${reqCBData.requestId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` }
  });
  console.log(`✓ Charlie connected with Bob.`);

  // 5. David (third party) views Bob's followers list
  const dFollowersRes = await fetch(`${BASE_URL}/follow/users/${userB._id}/followers`, {
    headers: { Authorization: `Bearer ${tokenD}` }
  });
  const dFollowersData = await dFollowersRes.json();
  if (!dFollowersData.success || dFollowersData.users.length !== 2) {
    throw new Error(`Expected 2 followers for Bob, got: ${JSON.stringify(dFollowersData)}`);
  }

  const followerUsernames = dFollowersData.users.map((u) => u.username);
  if (!followerUsernames.includes(userA.username) || !followerUsernames.includes(userC.username)) {
    throw new Error(`Followers list missing Alice or Charlie: ${JSON.stringify(followerUsernames)}`);
  }

  // Verify relationship states relative to David: neither Alice nor Charlie is connected to David
  dFollowersData.users.forEach((u) => {
    if (u.relationshipStatus !== 'none') {
      throw new Error(`Expected relationshipStatus 'none' for David towards ${u.username}, got: ${u.relationshipStatus}`);
    }
  });
  console.log(`✓ David sees Bob's 2 followers (Alice & Charlie) with relationshipStatus='none' ("Follow").`);

  // 6. David views Bob's following list
  const dFollowingRes = await fetch(`${BASE_URL}/follow/users/${userB._id}/following`, {
    headers: { Authorization: `Bearer ${tokenD}` }
  });
  const dFollowingData = await dFollowingRes.json();
  if (!dFollowingData.success || dFollowingData.users.length !== 2) {
    throw new Error(`Expected 2 following for Bob, got: ${JSON.stringify(dFollowingData)}`);
  }
  console.log(`✓ David sees Bob's 2 following accounts (Alice & Charlie).`);

  // 7. Alice views Bob's followers list: Alice should see herself as 'self'
  const aFollowersRes = await fetch(`${BASE_URL}/follow/users/${userB._id}/followers`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const aFollowersData = await aFollowersRes.json();
  const aliceItem = aFollowersData.users.find((u) => u.username === userA.username);
  if (aliceItem.relationshipStatus !== 'self') {
    throw new Error(`Expected Alice to see herself as 'self', got: ${aliceItem.relationshipStatus}`);
  }
  console.log(`✓ Alice sees herself as 'self' in Bob's followers list.`);

  // 8. Alice blocks Charlie: Alice should see Charlie as 'blocked'
  await fetch(`${BASE_URL}/follow/block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ targetUserId: userC._id })
  });
  const aFollowersPostBlockRes = await fetch(`${BASE_URL}/follow/users/${userB._id}/followers`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const aFollowersPostBlockData = await aFollowersPostBlockRes.json();
  const charlieItem = aFollowersPostBlockData.users.find((u) => u.username === userC.username);
  if (charlieItem.relationshipStatus !== 'blocked') {
    throw new Error(`Expected Charlie to be marked 'blocked' for Alice, got: ${charlieItem.relationshipStatus}`);
  }
  console.log(`✓ Alice sees Charlie as 'blocked' in Bob's followers list.`);

  // 9. Alice unfollows Bob: Bob's followers drops to 1
  await fetch(`${BASE_URL}/follow/unfollow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ targetUserId: userB._id })
  });

  const postUnfollowRes = await fetch(`${BASE_URL}/follow/users/${userB._id}/followers`, {
    headers: { Authorization: `Bearer ${tokenD}` }
  });
  const postUnfollowData = await postUnfollowRes.json();
  if (postUnfollowData.users.length !== 1 || postUnfollowData.users[0].username !== userC.username) {
    throw new Error(`Expected only Charlie in Bob's followers after Alice unfollowed, got: ${JSON.stringify(postUnfollowData)}`);
  }
  console.log(`✓ Dynamic update verified: After Alice unfollows Bob, Bob has exactly 1 follower (Charlie).`);

  console.log('\n======================================================');
  console.log(' ALL FOLLOWERS & FOLLOWING LIST TESTS PASSED! 🎉');
  console.log('======================================================\n');
}

main()
  .catch((err) => {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
  });

