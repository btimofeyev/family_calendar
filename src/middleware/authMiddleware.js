const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  if (req.path.startsWith('/api/invitations/check/')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
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

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ error: "Token expired, please refresh" });
      }
      return res.status(401).json({ error: "Token invalid" });
    }

    req.user = { 
      id: parseInt(decoded.userId, 10) || null,
      family_id: parseInt(decoded.familyId, 10) || null
    };
    console.log('req.user in authMiddleware:', req.user);
    return next();
  });
};

module.exports = authMiddleware;
