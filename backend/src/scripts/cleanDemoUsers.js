const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// Explicit list of known genuine user emails / usernames to never touch
const GENUINE_PROTECTED_USERS = [
  'aakashboopathi2006@gmail.com',
  'aakash_18_'
];

const connectDB = require('../config/db');

async function cleanDemoAccounts() {
  console.log('========================================================');
  console.log('   NEXA Database Demo & Test Account Cleanup Utility    ');
  console.log('========================================================');

  console.log('[Cleanup] Connecting to database...');
  await connectDB();

  // 1. Identify all demo/test accounts
  const demoUsers = await User.find({
    $and: [
      {
        email: { $nin: GENUINE_PROTECTED_USERS },
        username: { $nin: GENUINE_PROTECTED_USERS }
      },
      {
        $or: [
          { email: { $regex: /@(nexa\.io|nexa\.chat)$/i } },
          { username: { $regex: /^(alex_|elena_|user_[ab]_|test_|verif_|ui_tester_|aakash_\d+$)/i } }
        ]
      }
    ]
  });

  console.log(`[Cleanup] Identified ${demoUsers.length} demo/test account(s) in database:`);
  demoUsers.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.name} (@${u.username} | ${u.email}) [ID: ${u._id}]`);
  });

  if (demoUsers.length === 0) {
    console.log('[Cleanup] No demo accounts found. Database is already clean.');
    process.exit(0);
  }

  const demoUserIds = demoUsers.map((u) => u._id);

  // 2. Delete test messages and conversations that exclusively belong to demo users
  const deletedMessages = await Message.deleteMany({ sender: { $in: demoUserIds } });
  console.log(`[Cleanup] Removed ${deletedMessages.deletedCount} test message(s).`);

  const deletedConvs = await Conversation.deleteMany({
    participants: { $not: { $elemMatch: { $nin: demoUserIds } } }
  });
  console.log(`[Cleanup] Removed ${deletedConvs.deletedCount} demo conversation(s).`);

  // 3. Delete the demo user records
  const result = await User.deleteMany({ _id: { $in: demoUserIds } });
  console.log(`[Cleanup] Successfully removed ${result.deletedCount} demo user(s).`);

  // 4. Verify genuine registered users remaining
  const remainingUsers = await User.find({});
  console.log('\n========================================================');
  console.log(`✅ Database now has ${remainingUsers.length} genuine registered user(s):`);
  remainingUsers.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.name} (@${u.username} | ${u.email})`);
  });
  console.log('========================================================\n');

  process.exit(0);
}

cleanDemoAccounts().catch((err) => {
  console.error('[Cleanup Error]:', err);
  process.exit(1);
});
