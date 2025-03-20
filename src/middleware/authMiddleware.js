// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Define public paths that should bypass authentication
const PUBLIC_PATHS = [
  '/api/invitations/check/',
  '/api/auth/refresh-token',
  '/api/account/confirm-deletion',
  '/account/confirm-deletion', // Add this path as well
  '/api/health'
];

const authMiddleware = async (req, res, next) => {
  // Debug information - log the path being accessed
  console.log(`[Auth Middleware] Processing request:`, {
    originalUrl: req.originalUrl,
    path: req.path,
    baseUrl: req.baseUrl,
    fullPath: `${req.baseUrl}${req.path}`,
    method: req.method
  });
  // Check if the path should bypass authentication
  for (const publicPath of PUBLIC_PATHS) {
    if (req.path === publicPath || (publicPath.endsWith('/') && req.path.startsWith(publicPath))) {
      console.log(`[Auth Middleware] Bypassing authentication for public path: ${req.path}`);
      return next();
    }
  }

  // For all other paths, require authentication
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log(`[Auth Middleware] No auth header provided for path: ${req.path}`);
    return res.status(401).json({ error: "No token provided" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2) {
    return res.status(401).json({ error: "Token error" });
  }

  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ error: "Token malformatted" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ error: "Token expired" });
      }
      return res.status(401).json({ error: "Token invalid" });
    }

    const userId = parseInt(decoded.userId, 10) || null;
    
    // Get the family parameter from the request URL if it exists
    const familyIdFromUrl = req.params.familyId || null;
    
    // Check if the user exists and if they're a member of the specified family
    if (userId && familyIdFromUrl) {
      try {
        const membershipQuery = {
          text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
          values: [userId, familyIdFromUrl],
        };
        const membershipResult = await pool.query(membershipQuery);
        
        // If user is not a member of this family, deny access
        if (membershipResult.rows.length === 0) {
          const userFamiliesQuery = {
            text: "SELECT family_id FROM user_families WHERE user_id = $1",
            values: [userId],
          };
          const userFamilies = await pool.query(userFamiliesQuery);
          
          // If user has any families but not this one, return 403
          if (userFamilies.rows.length > 0) {
            return res.status(403).json({ 
              error: "You are not a member of this family",
              userFamilies: userFamilies.rows.map(row => row.family_id)
            });
          }
        }
      } catch (error) {
        console.error("Error checking family membership:", error);
        // Continue with request even if membership check fails
      }
    }

    req.user = { 
      id: userId,
      // Use family ID from URL if provided, otherwise from token
      family_id: familyIdFromUrl || (parseInt(decoded.familyId, 10) || null)
    };
    
    return next();
  });
};

module.exports = authMiddleware;