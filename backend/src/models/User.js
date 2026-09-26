const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 60
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false
    },
    passwordHash: {
      type: String,
      select: false
    },

    // Email Verification
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String,
      select: false
    },
    emailVerificationExpires: {
      type: Date,
      select: false
    },

    // Password Reset
    passwordResetToken: {
      type: String,
      select: false
    },
    passwordResetExpires: {
      type: Date,
      select: false
    },

    // Two-Factor Authentication (TOTP)
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: {
      type: String,
      select: false
    },
    tempTwoFactorSecret: {
      type: String,
      select: false
    },
    twoFactorRecoveryCodes: {
      type: [
        {
          codeHash: { type: String, required: true },
          used: { type: Boolean, default: false },
          usedAt: { type: Date }
        }
      ],
      select: false,
      default: []
    },

    // Active Sessions Tracking
    sessions: {
      type: [
        {
          sessionId: { type: String, required: true },
          deviceInfo: { type: String, default: 'Web Browser' },
          ip: { type: String, default: '127.0.0.1' },
          lastActive: { type: Date, default: Date.now },
          createdAt: { type: Date, default: Date.now }
        }
      ],
      select: false,
      default: []
    },

    // Brute-force & lockouts
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date
    },
    twoFactorAttempts: {
      type: Number,
      default: 0
    },
    twoFactorLockUntil: {
      type: Date
    },

    // Profile & Social
    avatar: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      maxlength: 180,
      default: 'Exploring NEXA Real-Time Messenger.'
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    settings: {
      appearance: {
        type: String,
        enum: ['dark', 'light', 'system'],
        default: 'dark'
      },
      privacy: {
        lastSeen: {
          type: String,
          enum: ['everyone', 'contacts', 'nobody'],
          default: 'everyone'
        },
        onlineStatus: {
          type: String,
          enum: ['everyone', 'contacts', 'nobody'],
          default: 'everyone'
        },
        readReceipts: {
          type: Boolean,
          default: true
        }
      },
      notifications: {
        sound: {
          type: Boolean,
          default: true
        },
        desktop: {
          type: Boolean,
          default: true
        },
        previews: {
          type: Boolean,
          default: true
        }
      }
    }
  },
  {
    timestamps: true
  }
);

// Password hashing pre-save hook
userSchema.pre('save', async function (next) {
  if (this.isModified('password') || this.isModified('passwordHash')) {
    const rawPass = this.password || this.passwordHash;
    if (rawPass && !rawPass.startsWith('$2a$') && !rawPass.startsWith('$2b$')) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(rawPass, salt);
      this.password = hash;
      this.passwordHash = hash;
    } else if (rawPass) {
      this.password = rawPass;
      this.passwordHash = rawPass;
    }
  }
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  const hash = this.passwordHash || this.password;
  if (!hash) return false;
  return await bcrypt.compare(enteredPassword, hash);
};

// Check if login is temporarily locked
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Check if 2FA attempts are temporarily locked
userSchema.methods.is2FALocked = function () {
  return !!(this.twoFactorLockUntil && this.twoFactorLockUntil > Date.now());
};

// Generate and hash password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  return resetToken;
};

// Generate and hash email verification token
userSchema.methods.createEmailVerificationToken = function () {
  const verifyToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(verifyToken).digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return verifyToken;
};

// Safe JSON transform: strictly strip passwords, tokens, secrets, internal recovery hashes, and session details
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordHash;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.twoFactorSecret;
  delete obj.tempTwoFactorSecret;
  delete obj.twoFactorRecoveryCodes;
  delete obj.sessions;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  delete obj.twoFactorAttempts;
  delete obj.twoFactorLockUntil;
  return obj;
};

// Indexing for rapid username/email/name search & strict uniqueness enforcement
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1, email: 1 });
userSchema.index({ name: 'text', username: 'text' });

const User = mongoose.model('User', userSchema);
module.exports = User;
