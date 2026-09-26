const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, access token is missing'
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'nexa_production_grade_jwt_secret_token_key_9948271'
    );

    // Reject temporary 2FA tokens attempting to access protected routes
    if (decoded.twoFactorPending) {
      return res.status(401).json({
        success: false,
        message: 'Two-factor authentication verification required'
      });
    }

    const user = await User.findById(decoded.id)
      .select('+sessions')
      .select('-password -passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists'
      });
    }

    // If token includes sessionId, verify the session has not been revoked
    if (decoded.sessionId) {
      const activeSession = user.sessions?.find((s) => s.sessionId === decoded.sessionId);
      if (!activeSession) {
        return res.status(401).json({
          success: false,
          message: 'Your session has been logged out or revoked. Please sign in again.'
        });
      }

      // Update session last active time occasionally (throttled to avoid DB writes on every single sub-request)
      const now = new Date();
      if (!activeSession.lastActive || now - new Date(activeSession.lastActive) > 60000) {
        activeSession.lastActive = now;
        user.save({ validateBeforeSave: false }).catch(() => {});
      }

      req.sessionId = decoded.sessionId;
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, invalid or expired token'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'nexa_production_grade_jwt_secret_token_key_9948271'
    );
    if (!decoded.twoFactorPending && decoded.id) {
      const user = await User.findById(decoded.id).select('-password -passwordHash');
      if (user) {
        req.user = user;
      }
    }
  } catch (err) {
    // Ignore invalid/expired tokens for optional authentication
  }

  next();
};

module.exports = { protect, optionalAuth };
