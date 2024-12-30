const express = require("express");
const router = express.Router();

const {
  register,
  login,
  logout,
  sendOTPForForgotPassword,
  verifyOtpForForgotPassword,
  deleteByUser,
  deleteByAdmin,
  getprofile,
  getProfileImage,
  follow,
  getFollowers,
  getUserProfile,
  getUserWithArticles,
  getUserLikeAndSaveArticles,
  //updateReadArticles,
 // collectMonthlyRecordsForReading,
  //collectMonthlyRecordsForWriting,
  checkOtp,
  refreshToken,
  updateProfileImage,
  getUserDetails,
  updateUserPassword,
  updateUserGeneralDetails,
  updateUserContactDetails,
  updateUserProfessionalDetails,
  checkUserHandle
} = require("../controllers/usersControllers");

const {
  verifyEmail,
  sendVerificationEmail,
  Sendverifymail,
  resendVerificationEmail,
} = require("../controllers/emailservice");
const authenticateToken = require("../middleware/authentcatetoken");

router.get("/hello", (req, res) => {
  console.log("Hello World Route Executed");
  res.send("Hello World");
});

// Register New User
router.post("/user/register", register);

// Login User Route
router.post("/user/login", login);

// Refresh Token
router.post("/user/refreshToken", refreshToken);

// Get profile
router.get("/user/getprofile/", authenticateToken, getprofile);

// Get profile image
router.get('/user/getprofileimage/:userId',authenticateToken, getProfileImage);
// Get Other's Profile
router.get("/user/getprofile/:id", authenticateToken, getUserProfile);
// Follow and Unfollow Routes
router.post("/user/follow", authenticateToken, follow);
router.get("/user/:userId/followers", authenticateToken, getFollowers);

// Forget password
router.post("/user/forgotpassword", sendOTPForForgotPassword);
router.post("/user/verifyOtp", checkOtp);
// verify password
router.post("/user/verifypassword", verifyOtpForForgotPassword);

router.post("/user/deleteUser", deleteByUser);
router.post("/admin/deleteUser", deleteByAdmin);

router.get("/user/verifyEmail", verifyEmail);
router.post("/user/verifyEmail", Sendverifymail);
router.post("/user/resend-verification-mail", resendVerificationEmail);

// Update read articles
//router.post("/user/update-read-articles", updateReadArticles);

// Collect monthly records for reading
/*
router.get(
  "/user/collect-monthly-records-for-reading",
  collectMonthlyRecordsForReading
);
*/

// Collect monthly records for writing
/*
router.get(
  "/user/collect-monthly-records-for-writing",
  collectMonthlyRecordsForWriting
);
*/

// Get user with articles
router.get("/user/articles", authenticateToken, getUserWithArticles);

// Get user liked and saved articles
router.get(
  "/user/liked-saved-articles",
  authenticateToken,
  getUserLikeAndSaveArticles
);

router.post("/user/logout", authenticateToken, logout);
router.post(
  "/user/update-profile-image",
  authenticateToken,
  updateProfileImage
);

// Get user details
router.get("/user/getdetails", authenticateToken, getUserDetails);

// Update user password
router.put("/user/update-password", authenticateToken, updateUserPassword);

// Update user general details
router.put("/user/update-general-details", authenticateToken, updateUserGeneralDetails);

// Update user contact details
router.put("/user/update-contact-details", authenticateToken, updateUserContactDetails);

// Update user professional details
router.put("/user/update-professional-details", authenticateToken, updateUserProfessionalDetails);
router.post("/user/check-user-handle", checkUserHandle); // registration process, open routing
module.exports = router;
