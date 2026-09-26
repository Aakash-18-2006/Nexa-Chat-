const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('--- Starting My Profile & Settings Navigation Verification ---');

  const ts = Date.now();

  // 1. Register User A (Main user)
  const regARes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Owner Alice',
      username: `alice_${ts}`,
      email: `alice_${ts}@test.com`,
      password: 'password123'
    })
  });
  const dataA = await regARes.json();
  if (!dataA.success) throw new Error('Failed to register Alice: ' + JSON.stringify(dataA));
  const userA = dataA.user;
  const tokenA = dataA.token;
  console.log(`✓ Registered User A (My Profile): @${userA.username}`);

  // 2. Register User B (Follower)
  const regBRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Follower Bob',
      username: `bob_${ts}`,
      email: `bob_${ts}@test.com`,
      password: 'password123'
    })
  });
  const dataB = await regBRes.json();
  const userB = dataB.user;
  const tokenB = dataB.token;

  // 3. Connect Bob with Alice (Bob follows Alice, Alice connects)
  const reqRes = await fetch(`${BASE_URL}/follow/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ targetUserId: userA._id })
  });
  const reqData = await reqRes.json();
  const acceptRes = await fetch(`${BASE_URL}/follow/request/${reqData.requestId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const acceptData = await acceptRes.json();
  if (!acceptData.success) throw new Error('Accept failed: ' + JSON.stringify(acceptData));
  console.log(`✓ Connected Bob with Alice (Bob is a real follower/following of Alice).`);

  // 4. Fetch Alice's Profile as Alice (My Profile)
  const myProfileRes = await fetch(`${BASE_URL}/users/${userA._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const myProfileData = await myProfileRes.json();
  if (!myProfileData.success) throw new Error('Failed to get My Profile: ' + JSON.stringify(myProfileData));
  
  const myProf = myProfileData.user;
  if (myProf.relationshipStatus !== 'self') {
    throw new Error(`Expected relationshipStatus='self' for My Profile, got: ${myProf.relationshipStatus}`);
  }
  if (myProf.name !== 'Owner Alice' || myProf.username !== userA.username) {
    throw new Error(`Profile data mismatch: name=${myProf.name}, username=${myProf.username}`);
  }
  if (myProf.followersCount !== 1 || myProf.followingCount !== 1) {
    throw new Error(`Expected followersCount=1, followingCount=1, got: ${myProf.followersCount}, ${myProf.followingCount}`);
  }
  console.log(`✓ My Profile verified: relationshipStatus='self', real name='${myProf.name}', followers=1, following=1.`);

  // 5. Test Alice's Followers List
  const followersRes = await fetch(`${BASE_URL}/follow/users/${userA._id}/followers`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const followersData = await followersRes.json();
  if (!followersData.success || followersData.users.length !== 1) {
    throw new Error(`Expected exactly 1 real follower for Alice, got: ${JSON.stringify(followersData)}`);
  }
  const followerItem = followersData.users[0];
  if (followerItem.username !== userB.username || followerItem.relationshipStatus !== 'connected') {
    throw new Error(`Unexpected follower item data: ${JSON.stringify(followerItem)}`);
  }
  console.log(`✓ Real Followers List verified for My Profile: contains @${followerItem.username} with status '${followerItem.relationshipStatus}'.`);

  // 6. Test Alice's Following List
  const followingRes = await fetch(`${BASE_URL}/follow/users/${userA._id}/following`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const followingData = await followingRes.json();
  if (!followingData.success || followingData.users.length !== 1) {
    throw new Error(`Expected exactly 1 real following for Alice, got: ${JSON.stringify(followingData)}`);
  }
  const followingItem = followingData.users[0];
  if (followingItem.username !== userB.username) {
    throw new Error(`Unexpected following item data: ${JSON.stringify(followingItem)}`);
  }
  console.log(`✓ Real Following List verified for My Profile: contains @${followingItem.username}.`);

  // 7. Test Settings Blocked Accounts (separate from My Profile)
  const blockedRes = await fetch(`${BASE_URL}/follow/blocked`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const blockedData = await blockedRes.json();
  if (!blockedData.success || !Array.isArray(blockedData.blockedUsers)) {
    throw new Error(`Expected blocked users array for Settings, got: ${JSON.stringify(blockedData)}`);
  }
  console.log(`✓ Settings Blocked Accounts endpoint verified: ${blockedData.blockedUsers.length} blocked users.`);

  // 8. Test Edit Profile (updating name and bio via auth API)
  const updateRes = await fetch(`${BASE_URL}/auth/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      name: 'Owner Alice Updated',
      bio: 'Living my best life on NEXA!'
    })
  });
  const updateData = await updateRes.json();
  if (!updateData.success || updateData.user.name !== 'Owner Alice Updated' || updateData.user.bio !== 'Living my best life on NEXA!') {
    throw new Error('Edit Profile failed: ' + JSON.stringify(updateData));
  }

  // Re-fetch My Profile to verify persistence
  const updatedMyProfileRes = await fetch(`${BASE_URL}/users/${userA._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const updatedMyProfileData = await updatedMyProfileRes.json();
  if (updatedMyProfileData.user.name !== 'Owner Alice Updated' || updatedMyProfileData.user.bio !== 'Living my best life on NEXA!') {
    throw new Error('Profile changes did not persist: ' + JSON.stringify(updatedMyProfileData));
  }
  console.log(`✓ Edit Profile verified: name updated to '${updatedMyProfileData.user.name}' and bio persisted in real DB.`);

  console.log('\n======================================================');
  console.log(' ALL MY PROFILE & SETTINGS NAVIGATION TESTS PASSED! 🎉');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
