const crypto = require('crypto');
const User = require('../models/User');
const EmailChangeToken = require('../models/EmailChangeToken');
const { hashToken } = require('../utils/cryptoUtils');
const emailService = require('../services/emailService');

/**
 * Helper to determine configured backend URL
 */
const getBackendUrl = (req) => {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, '');
  if (req && req.get('host')) {
    const protocol = req.protocol || 'http';
    return `${protocol}://${req.get('host')}`;
  }
  return 'http://localhost:5000';
};

/**
 * Minimal responsive HTML page with green animated circle and checkmark
 */
const renderSuccessHtml = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Change Successful — NEXA</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #0b0f19;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 20px;
      padding: 56px 36px 48px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .circle-container {
      width: 96px;
      height: 96px;
      margin: 0 auto 28px;
      position: relative;
    }
    .success-circle {
      width: 96px;
      height: 96px;
      background: rgba(16, 185, 129, 0.12);
      border: 3px solid #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 30px rgba(16, 185, 129, 0.4);
      animation: scaleUp 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    .checkmark-svg {
      width: 52px;
      height: 52px;
    }
    .checkmark-path {
      stroke: #10b981;
      stroke-width: 4;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      stroke-dasharray: 60;
      stroke-dashoffset: 60;
      animation: drawCheck 0.5s 0.35s ease-out forwards;
    }
    @keyframes scaleUp {
      0% {
        transform: scale(0);
        opacity: 0;
      }
      80% {
        transform: scale(1.1);
        opacity: 1;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
    @keyframes drawCheck {
      100% {
        stroke-dashoffset: 0;
      }
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 15px;
      color: #9ca3af;
      line-height: 1.6;
    }
    .brand {
      margin-top: 36px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #4b5563;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="circle-container">
      <div class="success-circle">
        <svg class="checkmark-svg" viewBox="0 0 52 52">
          <path class="checkmark-path" d="M14 27 L22 35 L38 17" />
        </svg>
      </div>
    </div>
    <h1>Email Change Successful</h1>
    <p>Your NEXA account email has been successfully changed.</p>
    <div class="brand">NEXA</div>
  </div>
</body>
</html>`;

/**
 * Minimal responsive HTML page for error states
 */
const renderErrorHtml = (title, message) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — NEXA</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #0b0f19;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 20px;
      padding: 56px 36px 48px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .error-circle {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: rgba(239, 68, 68, 0.12);
      border: 2px solid #ef4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .error-svg {
      width: 40px;
      height: 40px;
      stroke: #ef4444;
      stroke-width: 2.5;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 15px;
      color: #9ca3af;
      line-height: 1.6;
    }
    .brand {
      margin-top: 36px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #4b5563;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="error-circle">
      <svg class="error-svg" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="brand">NEXA</div>
  </div>
</body>
</html>`;

/**
 * GET /api/account/info
 * Retrieve authenticated user's account info (email, username, verification state)
 */
const getAccountInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      account: {
        email: user.email,
        username: user.username,
        name: user.name,
        isEmailVerified: user.isEmailVerified || false
      }
    });
  } catch (error) {
    console.error('[Account] getAccountInfo error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving account info' });
  }
};

/**
 * POST /api/account/change-email
 * Request a change of primary email address.
 * Sends a confirmation link pointing directly to the backend confirmation endpoint.
 * Does NOT immediately modify user's current email.
 */
const requestEmailChange = async (req, res) => {
  try {
    const { newEmail } = req.body;

    if (!newEmail || typeof newEmail !== 'string') {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // Must not be the user's current email
    if (cleanEmail === req.user.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'The new email address cannot be the same as your current email.'
      });
    }

    // Check if new email is already registered to another account
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'That email address is already associated with another account.'
      });
    }

    // Rate limiting: Maximum 5 requests in a 15-minute window per account
    const recentRequests = await EmailChangeToken.countDocuments({
      userId: req.user._id,
      createdAt: { $gt: new Date(Date.now() - 15 * 60 * 1000) }
    });
    if (recentRequests >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many email change requests. Please wait 15 minutes before requesting again.'
      });
    }

    // Invalidate previous pending tokens for this user
    await EmailChangeToken.deleteMany({ userId: req.user._id });

    // Generate cryptographically secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresInMinutes = 30;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // Store in dedicated EmailChangeToken collection
    await EmailChangeToken.create({
      userId: req.user._id,
      newEmail: cleanEmail,
      tokenHash,
      expiresAt
    });

    // Build dedicated backend confirmation URL (Gmail button clicks directly to backend)
    const backendUrl = getBackendUrl(req);
    const confirmationUrl = `${backendUrl}/api/account/confirm-email-change?token=${rawToken}`;

    // Dispatch confirmation email in background (non-blocking)
    emailService.sendEmailChangeConfirmation({
      to: cleanEmail,
      name: req.user.name || req.user.username,
      confirmationUrl,
      expiresInMinutes
    }).then(() => {
      console.log(`[Account] Email change confirmation dispatched for user @${req.user.username} to new email: ${cleanEmail}`);
    }).catch((emailErr) => {
      console.error('[Account] Background email change confirmation error:', emailErr?.message || emailErr);
    });

    return res.status(200).json({
      success: true,
      message: `Confirmation email sent. We have sent a confirmation link to ${cleanEmail}. Please check your inbox and confirm the change.`,
      newEmail: cleanEmail
    });
  } catch (error) {
    console.error('[Account] requestEmailChange error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process email change request. Please verify your email server configuration.'
    });
  }
};

/**
 * GET /api/account/confirm-email-change
 * POST /api/account/confirm-email-change
 * Direct confirmation processing endpoint.
 * When clicked from Gmail:
 * 1. Reads token from query string
 * 2. Hashes & validates token
 * 3. Checks expiration & single-use status
 * 4. Checks target email uniqueness
 * 5. Updates user.email in database
 * 6. Marks token used
 * 7. Returns responsive HTML with green animated circle and checkmark
 */
const confirmEmailChange = async (req, res) => {
  const isGetRequest = req.method === 'GET';
  const token = req.query.token || req.params.token || (req.body && req.body.token);

  const respondError = (title, message, code = 'INVALID', status = 400) => {
    if (isGetRequest) {
      return res.status(status).send(renderErrorHtml(title, message));
    }
    return res.status(status).json({ success: false, code, message });
  };

  try {
    if (!token) {
      return respondError('Email Change Link Invalid', 'This confirmation link is invalid.', 'INVALID', 400);
    }

    const tokenHash = hashToken(token);
    const record = await EmailChangeToken.findOne({ tokenHash });

    if (!record) {
      return respondError('Email Change Link Invalid', 'This confirmation link is invalid.', 'INVALID', 400);
    }

    if (record.usedAt) {
      return respondError('Email Change Already Completed', 'This confirmation link has already been used.', 'USED', 400);
    }

    if (record.expiresAt < new Date()) {
      return respondError('Email Change Link Expired', 'This confirmation link has expired. Please request a new email change.', 'EXPIRED', 400);
    }

    // Re-verify uniqueness constraint in database
    const conflict = await User.findOne({ email: record.newEmail });
    if (conflict && conflict._id.toString() !== record.userId.toString()) {
      return respondError('Email Change Link Invalid', 'That email address is already associated with another account.', 'CONFLICT', 400);
    }

    const user = await User.findById(record.userId);
    if (!user) {
      return respondError('Email Change Link Invalid', 'User account associated with this request was not found.', 'NOT_FOUND', 404);
    }

    const oldEmail = user.email;
    const newEmail = record.newEmail;

    // Apply email update to database immediately
    user.email = newEmail;
    user.isEmailVerified = true;
    await user.save({ validateBeforeSave: false });

    // Mark token permanently as used
    record.usedAt = new Date();
    await record.save();

    // Invalidate any other pending tokens for this user
    await EmailChangeToken.deleteMany({ userId: user._id, _id: { $ne: record._id } });

    // Send security alerts to both old and new email addresses asynchronously
    Promise.all([
      emailService.sendSecurityNotificationEmail({
        to: oldEmail,
        name: user.name || user.username,
        alertTitle: 'Account Email Address Changed',
        details: `The primary email for your NEXA account was changed to ${newEmail}. If you did not make this change, please secure your account immediately.`
      }),
      emailService.sendSecurityNotificationEmail({
        to: newEmail,
        name: user.name || user.username,
        alertTitle: 'Account Email Address Confirmed',
        details: `Your NEXA account primary email address has been updated to ${newEmail}.`
      })
    ]).catch((err) => {
      console.warn('[Account] Security notification delivery note:', err.message);
    });

    console.log(`[Account] Successfully updated email for user @${user.username} from ${oldEmail} to ${newEmail}`);

    if (isGetRequest) {
      return res.status(200).send(renderSuccessHtml());
    }

    return res.status(200).json({
      success: true,
      message: 'Email Change Successful',
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('[Account] confirmEmailChange error:', error);
    return respondError('Server Error', 'An unexpected error occurred while confirming your email change.', 'SERVER_ERROR', 500);
  }
};

/**
 * POST /api/account/change-username
 * Updates the authenticated user's username after verifying format and global uniqueness.
 */
const changeUsername = async (req, res) => {
  try {
    const rawUsername = req.body.newUsername || req.body.username;

    if (!rawUsername || typeof rawUsername !== 'string' || rawUsername.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid username.'
      });
    }

    const cleanUsername = rawUsername.trim().toLowerCase();
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;

    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3–30 characters and contain only letters, numbers, and underscores.'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If identical to user's current username
    if (cleanUsername === user.username.toLowerCase()) {
      return res.status(200).json({
        success: true,
        message: 'Username unchanged.',
        user: user.toSafeObject()
      });
    }

    // Check if new username is already taken by another account
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Username already in use'
      });
    }

    const oldUsername = user.username;
    user.username = cleanUsername;
    await user.save();

    console.log(`[Account] Username successfully updated for user ID ${user._id}: @${oldUsername} -> @${cleanUsername}`);

    return res.status(200).json({
      success: true,
      message: 'Username changed successfully',
      username: cleanUsername,
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('[Account] changeUsername error:', error);
    if (error.code === 11000 || (error.name === 'MongoServerError' && error.message.includes('duplicate key'))) {
      return res.status(400).json({
        success: false,
        message: 'Username already in use'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Server error while updating username'
    });
  }
};

module.exports = {
  getAccountInfo,
  requestEmailChange,
  confirmEmailChange,
  changeUsername
};

