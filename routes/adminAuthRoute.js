const express = require("express");
const router = express.Router();

const {register, login, logout, getprofile, updateAdminPassword, editProfile, getMonthlyBreakDownByYear, getDailyBreakdownByMonth} = require('../controllers/admin/adminAuthController');
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
router.get('admin/getprofile', authenticateToken, getprofile);
router.post('/admin/update-password',  updateAdminPassword);
router.post('/admin/update-profile', authenticateToken, editProfile);
router.get('/admin/get-yearly-contribution', authenticateToken, getMonthlyBreakDownByYear);
router.get('/admin/get-monthly-contribution', authenticateToken, getDailyBreakdownByMonth);

module.exports = router;

//sendOTPForForgotPassword,
//verifyOtpForForgotPassword,
//checkOtp,
//updateUserPassword,