const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
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
      return res.status(401).json({ error: "Token invalid" });
    }

    req.user = { 
        id: parseInt(decoded.userId, 10),
        family_id: parseInt(decoded.familyId, 10)
    };    return next();
  });
};

module.exports = authMiddleware;