const express = require("express");
const router = express.Router();

const {register, login, logout} = require('../controllers/admin/adminAuthController');
const {
    verifyEmail,
    sendVerificationEmail,
    Sendverifymail,
    resendVerificationEmail,
  } = require("../controllers/emailservice");
const authenticateToken = require("../middleware/authentcatetoken");

// Register New User
router.post("/admin/register", register);

// Login User Route
router.post("/admin/login", login);

router.post("/admin/logout", authenticateToken, logout);

router.get("/admin/verifyEmail", verifyEmail);
router.post("/admin/verifyEmail", Sendverifymail);
router.post("/admin/resend-verification-mail", resendVerificationEmail);

module.exports = router;