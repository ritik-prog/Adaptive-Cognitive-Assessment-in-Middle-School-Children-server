const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Verify JWT token
const authenticateToken = async(req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: {
          message: 'Access token required',
          code: 'TOKEN_REQUIRED'
        }
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: {
          message: 'Invalid or inactive user',
          code: 'INVALID_USER'
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        }
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        }
      });
    }

    return res.status(500).json({
      error: {
        message: 'Authentication failed',
        code: 'AUTH_ERROR'
      }
    });
  }
};

// Verify refresh token
const authenticateRefreshToken = async(req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: {
          message: 'Refresh token required',
          code: 'REFRESH_TOKEN_REQUIRED'
        }
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: {
          message: 'Invalid or inactive user',
          code: 'INVALID_USER'
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Refresh token authentication error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          message: 'Refresh token expired',
          code: 'REFRESH_TOKEN_EXPIRED'
        }
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: {
          message: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        }
      });
    }

    return res.status(500).json({
      error: {
        message: 'Refresh token authentication failed',
        code: 'REFRESH_AUTH_ERROR'
      }
    });
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        }
      });
    }

    next();
  };
};

// Check if user can access resource (own resource or admin/teacher)
const authorizeResourceAccess = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        }
      });
    }

    // Admin and teachers can access any resource
    if (['admin', 'teacher'].includes(req.user.role)) {
      return next();
    }

    // Students can only access their own resources
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];

    if (resourceUserId && resourceUserId !== req.user._id.toString()) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this resource',
          code: 'RESOURCE_ACCESS_DENIED'
        }
      });
    }

    next();
  };
};

// Generate JWT tokens
const generateTokens = (user) => {
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });

  return { accessToken, refreshToken };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async(req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-passwordHash');

      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

module.exports = {
  authenticateToken,
  authenticateRefreshToken,
  authorize,
  authorizeResourceAccess,
  generateTokens,
  optionalAuth
};
