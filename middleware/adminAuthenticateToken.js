const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../models/blackListedToken');
const Admin = require("../models/admin/adminModel");

const adminAuthenticateToken = async (req, res, next) => {
  const token = req.cookies.token || req.headers['authorization']?.split(' ')[1] || req.headers['authorization']?.split(' ')[2];
 // console.log('Token', token);
  if (!token) return res.status(401).json({ error: 'No token provided' });

  // check for blacklist
  try {
    const blacklistedToken = await BlacklistedToken.findOne({ token });

    if (blacklistedToken) {
      return res.status(403).send('Token is blacklisted');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.userId);
    if (!admin || !admin.isVerified) {
      return res.status(403).json({ error: 'Email not verified' });
    } else {
      req.userId = admin._id;
      next();
    }

  } catch (err) {
    console.log("middleware server error",err);
    res.status(500).json({ message: "Internal server error" });
  }

};

module.exports = adminAuthenticateToken;

