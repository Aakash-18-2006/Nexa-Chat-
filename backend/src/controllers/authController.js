const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { generateSecret, generateURI, verifySync } = require('otplib');
const QRCode = require('qrcode');
const emailService = require('../services/emailService');
const {
  encrypt,
  decrypt,
  hashToken,
  generateRecoveryCodesBatch
} = require('../utils/cryptoUtils');

// Helper to verify TOTP code with time-step window tolerance
const verifyTOTP = (token, secret) => {
  if (!token || !secret) return false;
  try {
    const res = verifySync({ token: token.toString().trim(), secret, window: 1 });
    return res && res.valid === true;
  } catch (err) {
    return false;
  }
};

// Helper to generate full JWT token with optional sessionId
const generateToken = (id, sessionId = null) => {
  const payload = { id };
  if (sessionId) payload.sessionId = sessionId;
  return jwt.sign(payload, process.env.JWT_SECRET || 'nexa_production_grade_jwt_secret_token_key_9948271', {
    expiresIn: '30d'
  });
};

// Helper to parse human-readable device info
const parseDeviceInfo = (req) => {
  const ua = req.headers['user-agent'] || '';
  let browser = 'Web Browser';
  let os = 'Device';

  if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edg/i.test(ua)) browser = 'Edge';

  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';

  return `${browser} on ${os}`;
};

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '127.0.0.1';
};

// ==========================================
// 1. REGISTER
// ==========================================
const register = async (req, res) => {
  try {
    const { name, username, email, password, avatar } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.toLowerCase().trim();

    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3–30 characters and contain only letters, numbers, and underscores.'
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }]
    });

    if (existingUser) {
      if (existingUser.username === cleanUsername) {
        return res.status(400).json({ success: false, message: 'Username already in use' });
      }
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    // Generate initial avatar using initials if not supplied
    const defaultAvatar =
      avatar && avatar.trim()
        ? avatar.trim()
        : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanUsername)}&backgroundColor=4f46e5,7c3aed,2563eb`;

    // Create session record
    const sessionId = crypto.randomBytes(16).toString('hex');
    const newSession = {
      sessionId,
      deviceInfo: parseDeviceInfo(req),
      ip: getClientIp(req),
      lastActive: new Date(),
      createdAt: new Date()
    };

    const user = new User({
      name: name.trim(),
      username: cleanUsername,
      email: cleanEmail,
      password,
      avatar: defaultAvatar,
      isEmailVerified: false,
      sessions: [newSession],
      isOnline: true,
      lastSeen: new Date()
    });

    // Create email verification token
    const verifyToken = user.createEmailVerificationToken();
    await user.save();

    // Send verification email in background (non-blocking)
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    const verificationUrl = `${clientUrl}/verify-email?token=${verifyToken}`;
    emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl
    }).catch((emailErr) => {
      console.error('[Register Background Verification Email Error]:', emailErr?.message || emailErr);
    });

    const token = generateToken(user._id, sessionId);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully. Please verify your email.',
      token,
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('[Register Error]:', error);
    if (error.code === 11000) {
      if (error.keyPattern?.username || error.message?.includes('username')) {
        return res.status(400).json({ success: false, message: 'Username already in use' });
      }
      if (error.keyPattern?.email || error.message?.includes('email')) {
        return res.status(400).json({ success: false, message: 'Email is already registered' });
      }
    }
    return res.status(500).json({ success: false, message: error.message || 'Server error during registration' });
  }
};

// ==========================================
// 2. EMAIL VERIFICATION
// ==========================================
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }

    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This verification link is invalid or has expired. Please request a new one.'
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Your email address has been verified successfully!'
    });
  } catch (error) {
    console.error('[Verify Email Error]:', error);
    return res.status(500).json({ success: false, message: 'Server error while verifying email' });
  }
};

const resendVerification = async (req, res) => {
  try {
    let email = req.body.email;
    if (!email && req.user) email = req.user.email;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email address' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail }).select('+emailVerificationToken +emailVerificationExpires');

    // Never reveal account existence
    const genericResponse = {
      success: true,
      message: 'If an unverified account exists with this email, a verification link has been sent.'
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'This email is already verified.'
      });
    }

    // Rate limiting: Ensure at least 60 seconds between resend requests
    if (user.emailVerificationExpires && user.emailVerificationExpires - Date.now() > 23 * 60 * 60 * 1000 + 59 * 60 * 1000) {
      return res.status(429).json({
        success: false,
        message: 'A verification email was recently sent. Please wait a minute before requesting another.'
      });
    }

    const verifyToken = user.createEmailVerificationToken();
    await user.save();

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    const verificationUrl = `${clientUrl}/verify-email?token=${verifyToken}`;

    // Send verification email in background (non-blocking)
    emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl
    }).catch((emailErr) => {
      console.error('[Resend Verification Background Email Error]:', emailErr?.message || emailErr);
    });

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error('[Resend Verification Error]:', error);
    return res.status(500).json({ success: false, message: 'Server error sending verification email' });
  }
};

// ==========================================
// 3. LOGIN & 2FA CHALLENGE
// ==========================================
const login = async (req, res) => {
  try {
    const rawId = req.body.identifier || req.body.email || req.body.username;
    const { password } = req.body;

    if (!rawId || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email/username and password' });
    }

    const cleanId = rawId.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: cleanId }, { username: cleanId }]
    }).select('+password +sessions +twoFactorEnabled +loginAttempts +lockUntil');

    // Generic error to prevent account enumeration
    const genericInvalidMsg = 'Invalid email or password.';

    if (!user) {
      return res.status(401).json({ success: false, message: genericInvalidMsg });
    }

    // Brute-force protection: Check if account login is temporarily locked
    if (user.isLocked()) {
      const waitMinutes = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
      return res.status(429).json({
        success: false,
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${waitMinutes} minute(s).`
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lockout
      }
      await user.save();
      return res.status(401).json({ success: false, message: genericInvalidMsg });
    }

    // Reset login attempts on successful password check
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    // Check if Two-Factor Authentication is enabled
    if (user.twoFactorEnabled) {
      await user.save();

      // Issue temporary 2FA token (valid for 5 minutes only)
      const tempToken = jwt.sign(
        { id: user._id, twoFactorPending: true },
        process.env.JWT_SECRET || 'nexa_production_grade_jwt_secret_token_key_9948271',
        { expiresIn: '5m' }
      );

      return res.status(200).json({
        success: true,
        twoFactorRequired: true,
        message: 'Two-factor authentication code required',
        tempToken
      });
    }

    // Direct Login (No 2FA)
    const sessionId = crypto.randomBytes(16).toString('hex');
    const newSession = {
      sessionId,
      deviceInfo: parseDeviceInfo(req),
      ip: getClientIp(req),
      lastActive: new Date(),
      createdAt: new Date()
    };

    user.sessions = user.sessions || [];
    user.sessions.push(newSession);
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const token = generateToken(user._id, sessionId);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error during login' });
  }
};

// ==========================================
// 4. VERIFY 2FA (LOGIN STEP 2)
// ==========================================
const verify2FA = async (req, res) => {
  try {
    const { tempToken, code, isRecoveryCode } = req.body;

    if (!tempToken || !code) {
      return res.status(400).json({ success: false, message: 'Verification code and temporary token are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(
        tempToken,
        process.env.JWT_SECRET || 'nexa_production_grade_jwt_secret_token_key_9948271'
      );
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Two-factor session expired. Please sign in again.'
      });
    }

    if (!decoded.twoFactorPending || !decoded.id) {
      return res.status(401).json({ success: false, message: 'Invalid two-factor session token' });
    }

    const user = await User.findById(decoded.id).select(
      '+twoFactorSecret +twoFactorRecoveryCodes +sessions +twoFactorAttempts +twoFactorLockUntil'
    );

    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: 'Two-factor authentication is not configured for this account' });
    }

    // Check 2FA brute force lockout
    if (user.is2FALocked()) {
      const waitMinutes = Math.ceil((user.twoFactorLockUntil - Date.now()) / (60 * 1000));
      return res.status(429).json({
        success: false,
        message: `Too many failed 2FA attempts. Please try again in ${waitMinutes} minute(s).`
      });
    }

    const cleanCode = code.toString().trim().toUpperCase().replace(/\s+/g, '');

    let isValid = false;
    let usedRecoveryCode = false;

    if (isRecoveryCode) {
      // Check backup recovery codes
      const hashedInput = hashToken(cleanCode);
      const codeIndex = user.twoFactorRecoveryCodes?.findIndex(
        (rc) => rc.codeHash === hashedInput && !rc.used
      );

      if (codeIndex !== -1 && codeIndex !== undefined) {
        user.twoFactorRecoveryCodes[codeIndex].used = true;
        user.twoFactorRecoveryCodes[codeIndex].usedAt = new Date();
        isValid = true;
        usedRecoveryCode = true;

        // Security notification email
        emailService.sendSecurityNotificationEmail({
          to: user.email,
          name: user.name,
          alertTitle: 'Backup Recovery Code Used',
          details: `A one-time backup recovery code was used to sign in from ${getClientIp(req)} (${parseDeviceInfo(req)}). If you did not do this, secure your account immediately.`
        }).catch(() => {});
      }
    } else {
      // TOTP Authenticator App 6-digit verification
      const decryptedSecret = decrypt(user.twoFactorSecret);
      if (decryptedSecret) {
        isValid = verifyTOTP(cleanCode, decryptedSecret);
      }
    }

    if (!isValid) {
      user.twoFactorAttempts = (user.twoFactorAttempts || 0) + 1;
      if (user.twoFactorAttempts >= 5) {
        user.twoFactorLockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await user.save();
      return res.status(400).json({
        success: false,
        message: isRecoveryCode ? 'Invalid or already used recovery code' : 'Invalid verification code'
      });
    }

    // Reset 2FA failed attempts
    user.twoFactorAttempts = 0;
    user.twoFactorLockUntil = undefined;

    // Issue new session
    const sessionId = crypto.randomBytes(16).toString('hex');
    const newSession = {
      sessionId,
      deviceInfo: parseDeviceInfo(req),
      ip: getClientIp(req),
      lastActive: new Date(),
      createdAt: new Date()
    };

    user.sessions = user.sessions || [];
    user.sessions.push(newSession);
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const fullToken = generateToken(user._id, sessionId);

    return res.status(200).json({
      success: true,
      message: 'Two-factor verification successful',
      token: fullToken,
      usedRecoveryCode,
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('[Verify 2FA Error]:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying two-factor code' });
  }
};

// ==========================================
// 5. 2FA SETUP (GENERATE QR & SECRET)
// ==========================================
const setup2FA = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password re-authentication required' });
    }

    const user = await User.findById(req.user._id).select('+password +tempTwoFactorSecret');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    // Generate fresh TOTP secret
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: 'NEXA Chat',
      label: user.email,
      secret
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    // Save temporary encrypted secret until confirmed
    user.tempTwoFactorSecret = encrypt(secret);
    await user.save();

    return res.status(200).json({
      success: true,
      secret,
      qrCodeDataUrl,
      otpauthUrl
    });
  } catch (error) {
    console.error('[Setup 2FA Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to initiate 2FA setup' });
  }
};

// ==========================================
// 6. 2FA CONFIRM & ACTIVATE
// ==========================================
const confirm2FA = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Verification code is required' });
    }

    const user = await User.findById(req.user._id).select('+tempTwoFactorSecret +twoFactorSecret +twoFactorRecoveryCodes');
    if (!user || !user.tempTwoFactorSecret) {
      return res.status(400).json({ success: false, message: 'No 2FA setup request found. Please initiate setup first.' });
    }

    const decryptedSecret = decrypt(user.tempTwoFactorSecret);
    const cleanCode = code.toString().trim();
    const isValid = verifyTOTP(cleanCode, decryptedSecret);

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid verification code. Please check your authenticator app.' });
    }

    // Generate 8 one-time backup recovery codes
    const plainRecoveryCodes = generateRecoveryCodesBatch(8);
    const recoveryCodeRecords = plainRecoveryCodes.map((c) => ({
      codeHash: hashToken(c),
      used: false
    }));

    user.twoFactorEnabled = true;
    user.twoFactorSecret = user.tempTwoFactorSecret;
    user.tempTwoFactorSecret = undefined;
    user.twoFactorRecoveryCodes = recoveryCodeRecords;
    await user.save();

    // Security alert email
    emailService.sendSecurityNotificationEmail({
      to: user.email,
      name: user.name,
      alertTitle: 'Two-Step Verification Enabled',
      details: 'Two-step verification has been successfully enabled on your NEXA account.'
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Two-factor verification enabled successfully!',
      recoveryCodes: plainRecoveryCodes
    });
  } catch (error) {
    console.error('[Confirm 2FA Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to confirm 2FA setup' });
  }
};

// ==========================================
// 7. DISABLE 2FA
// ==========================================
const disable2FA = async (req, res) => {
  try {
    const { password, code } = req.body;

    if (!password || !code) {
      return res.status(400).json({ success: false, message: 'Password and 2FA code are required to disable 2FA' });
    }

    const user = await User.findById(req.user._id).select('+password +twoFactorSecret +twoFactorRecoveryCodes');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    const cleanCode = code.toString().trim().toUpperCase().replace(/\s+/g, '');
    let isValid = false;

    // Check TOTP code
    const decryptedSecret = decrypt(user.twoFactorSecret);
    if (decryptedSecret && verifyTOTP(cleanCode, decryptedSecret)) {
      isValid = true;
    }

    // Or check recovery code
    if (!isValid && user.twoFactorRecoveryCodes) {
      const hashedInput = hashToken(cleanCode);
      const match = user.twoFactorRecoveryCodes.find((rc) => rc.codeHash === hashedInput && !rc.used);
      if (match) {
        match.used = true;
        isValid = true;
      }
    }

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid verification code or recovery code' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.tempTwoFactorSecret = undefined;
    user.twoFactorRecoveryCodes = [];
    await user.save();

    emailService.sendSecurityNotificationEmail({
      to: user.email,
      name: user.name,
      alertTitle: 'Two-Step Verification Disabled',
      details: 'Two-step verification has been disabled on your account. If you did not perform this change, secure your account immediately.'
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Two-step verification has been disabled.'
    });
  } catch (error) {
    console.error('[Disable 2FA Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to disable 2FA' });
  }
};

// ==========================================
// 8. REGENERATE RECOVERY CODES
// ==========================================
const regenerateRecoveryCodes = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required to regenerate recovery codes' });
    }

    const user = await User.findById(req.user._id).select('+password +twoFactorRecoveryCodes +twoFactorEnabled');
    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: 'Two-step verification is not enabled' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    // Invalidate all old codes and create 8 new codes
    const plainRecoveryCodes = generateRecoveryCodesBatch(8);
    user.twoFactorRecoveryCodes = plainRecoveryCodes.map((c) => ({
      codeHash: hashToken(c),
      used: false
    }));
    await user.save();

    emailService.sendSecurityNotificationEmail({
      to: user.email,
      name: user.name,
      alertTitle: 'Backup Recovery Codes Regenerated',
      details: 'Your two-step verification backup recovery codes have been regenerated. Previous codes are now invalid.'
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'New recovery codes generated successfully',
      recoveryCodes: plainRecoveryCodes
    });
  } catch (error) {
    console.error('[Regenerate Recovery Codes Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to regenerate recovery codes' });
  }
};

// ==========================================
// 9. SESSIONS MANAGEMENT
// ==========================================
const getSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+sessions');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const currentSessionId = req.sessionId;
    const sessions = (user.sessions || []).map((s) => ({
      sessionId: s.sessionId,
      deviceInfo: s.deviceInfo,
      ip: s.ip,
      lastActive: s.lastActive,
      createdAt: s.createdAt,
      isCurrent: s.sessionId === currentSessionId
    }));

    return res.status(200).json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('[Get Sessions Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
};

const revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required' });
    }

    const user = await User.findById(req.user._id).select('+sessions');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.sessions = (user.sessions || []).filter((s) => s.sessionId !== sessionId);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    console.error('[Revoke Session Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to revoke session' });
  }
};

const logoutAllDevices = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+sessions');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.sessions = [];
    user.isOnline = false;
    await user.save();

    emailService.sendSecurityNotificationEmail({
      to: user.email,
      name: user.name,
      alertTitle: 'All Sessions Logged Out',
      details: 'You have logged out of all devices and active sessions.'
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Logged out of all devices successfully'
    });
  } catch (error) {
    console.error('[Logout All Devices Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to log out of all devices' });
  }
};

// ==========================================
// 10. CURRENT USER & PROFILE
// ==========================================
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({
      success: true,
      user: user.toSafeObject()
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, bio, avatar, settings } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (avatar !== undefined) user.avatar = avatar;
    if (settings) {
      user.settings = {
        ...user.settings?.toObject(),
        ...settings
      };
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: user.toSafeObject()
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 11. CHANGE PASSWORD
// ==========================================
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new passwords' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long' });
    }

    const user = await User.findById(req.user._id).select('+password +sessions');
    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    user.password = newPassword;

    // Invalidate all other sessions except current session
    if (req.sessionId && user.sessions) {
      user.sessions = user.sessions.filter((s) => s.sessionId === req.sessionId);
    }

    await user.save();

    emailService.sendSecurityNotificationEmail({
      to: user.email,
      name: user.name,
      alertTitle: 'Password Changed',
      details: `Your NEXA account password was changed from ${getClientIp(req)} (${parseDeviceInfo(req)}).`
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 12. LOGOUT
// ==========================================
const logout = async (req, res) => {
  try {
    if (req.user) {
      const user = await User.findById(req.user._id).select('+sessions');
      if (user) {
        if (req.sessionId && user.sessions) {
          user.sessions = user.sessions.filter((s) => s.sessionId !== req.sessionId);
        }
        user.isOnline = false;
        user.lastSeen = new Date();
        await user.save();
      }
    }
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 13. FORGOT & RESET PASSWORD (BY USERNAME)
// ==========================================
const forgotPassword = async (req, res) => {
  try {
    const { username } = req.body;
    console.log('[Forgot Password Flow] Step 1: Forgot password request received');

    if (!username || !username.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your username'
      });
    }

    // Normalize username per NEXA standard (lowercase, trimmed)
    const cleanUsername = username.toLowerCase().trim();

    // Generic response to eliminate account/username enumeration
    const genericSuccessMessage =
      'If an account exists for this username, a password reset link has been sent to the email address associated with the account.';

    // Look up user exclusively by username
    const user = await User.findOne({ username: cleanUsername });
    console.log('[Forgot Password Flow] Step 2: Username lookup completed. Account found:', !!user);

    if (!user || !user.email) {
      console.log('[Forgot Password Flow] User account not found or has no registered email. Returning generic response.');
      return res.status(200).json({
        success: true,
        message: genericSuccessMessage
      });
    }

    // Generate secure single-use password reset token (valid for 30 minutes)
    const resetToken = user.createPasswordResetToken();
    console.log('[Forgot Password Flow] Step 3: Reset token generated');
    await user.save({ validateBeforeSave: false });
    console.log('[Forgot Password Flow] Step 4: Reset token saved');

    // Determine client URL
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;

    console.log('[Forgot Password Flow] Step 5: Dispatching reset email in background (non-blocking)');
    emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name || user.username,
      resetUrl,
      expiresInMinutes: 30
    }).then((emailResult) => {
      console.log('[Forgot Password Flow] Step 6: Email provider response received');
      console.log('   Delivery success:', emailResult?.success);
    }).catch(async (emailErr) => {
      // Distinguish the technical error category on the server
      if (emailErr.code === 'NO_SMTP_CONFIG' || emailErr.message?.includes('No SMTP')) {
        console.error('[Forgot Password Server Diagnostic - Category: SMTP Configuration Missing]');
        console.error('   Reason: SMTP_PASS is empty in backend/.env.');
        console.error('   Action: Generate a 16-character Google App Password at https://myaccount.google.com/apppasswords and set SMTP_PASS in backend/.env.');
      } else if (emailErr.code === 'EAUTH' || emailErr.responseCode === 535) {
        console.error('[Forgot Password Server Diagnostic - Category: SMTP Authentication Failure]');
        console.error('   Reason: Gmail rejected credentials (535 BadCredentials).');
        console.error('   Action: Ensure SMTP_PASS is a 16-character Google App Password (not your regular Gmail password).');
      } else if (emailErr.code === 'ECONNREFUSED' || emailErr.code === 'ETIMEDOUT' || emailErr.code === 'ESOCKET') {
        console.error('[Forgot Password Server Diagnostic - Category: SMTP Connection Failure]');
        console.error('   Reason: Failed to reach smtp.gmail.com:587.');
        console.error('   Action: Check internet access and outbound port 587 connectivity.');
      } else {
        console.error('[Forgot Password Server Diagnostic - Category: Email Send Failure]');
        console.error('   Reason:', emailErr?.message || emailErr);
      }

      // Clean up token only if it has not been replaced by a subsequent request
      try {
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        await User.updateOne(
          { _id: user._id, passwordResetToken: hashedToken },
          { $unset: { passwordResetToken: 1, passwordResetExpires: 1 } }
        );
      } catch (cleanupErr) {
        console.error('[Forgot Password Cleanup Error]:', cleanupErr?.message || cleanupErr);
      }
    });

    return res.status(200).json({
      success: true,
      message: genericSuccessMessage
    });
  } catch (error) {
    console.error('[Forgot Password Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while processing password reset request'
    });
  }
};

const validateResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is required'
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset link is invalid or has expired.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reset token is valid'
    });
  } catch (error) {
    console.error('[Validate Reset Token Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while validating token'
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both the reset token and your new password'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+password +passwordResetToken +passwordResetExpires +sessions');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset link is invalid or has expired.'
      });
    }

    // Set new password (pre-save hook will bcrypt hash)
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Invalidate all existing sessions after password reset
    user.sessions = [];
    await user.save();

    emailService.sendSecurityNotificationEmail({
      to: user.email,
      name: user.name,
      alertTitle: 'Password Reset Successful',
      details: 'Your account password was successfully reset. All prior active sessions were invalidated.'
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('[Reset Password Error]:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while resetting password'
    });
  }
};

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  verify2FA,
  setup2FA,
  confirm2FA,
  disable2FA,
  regenerateRecoveryCodes,
  getSessions,
  revokeSession,
  logoutAllDevices,
  getMe,
  updateProfile,
  changePassword,
  logout,
  forgotPassword,
  validateResetToken,
  resetPassword
};
