const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../models/blackListedToken');

const authenticateToken = async (req, res, next) => {
  const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];
  console.log('Token', token);
  if (!token) return res.status(401).json({ error: 'No token provided' });

  // check for blacklist
  const blacklistedToken = await BlacklistedToken.findOne({ token });

  if (blacklistedToken) {
    return res.status(403).send('Token is blacklisted');
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Token verification error:', err.message);
      return res.status(403).json({ error: 'Invalid token' });
    }

  //console.log("USER izzz", user)
    req.user = user;
    next();
  });
};

module.exports = authenticateToken;

