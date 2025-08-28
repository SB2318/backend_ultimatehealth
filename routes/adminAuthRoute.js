const express = require("express");
const router = express.Router();
const { register, login, logout, getprofile, updateAdminPassword, editProfile } = require('../controllers/admin/adminAuthController');
const {
  verifyEmail,
  sendVerificationEmail,
  Sendverifymail,
  resendVerificationEmail,
} = require("../controllers/emailservice");
const authenticateToken = require("../middleware/adminAuthenticateToken");

/**
 * @openapi
 * /admin/register:
 *   post:
 *     summary: Register as an admin user
 *     description: Creates a new admin user, hashes password, and generates a verification token.
 *                 After initial registration, you will receive an email with a verification link. 
 *                 You must verify your account before full access is granted.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_name
 *               - user_handle
 *               - email
 *               - password
 *             properties:
 *               user_name:
 *                 type: string
 *                 example: "John Doe"
 *               user_handle:
 *                 type: string
 *                 example: "johndoe123"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "StrongPass@123"
 *               Profile_avtar:
 *                 type: string
 *                 example: "https://cdn.example.com/avatar.png"
 *     responses:
 *       201:
 *         description: Registration successful. Email verification required.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Registration successful. Please verify your email."
 *                 token:
 *                   type: string
 *                   description: JWT verification token
 *       400:
 *         description: Missing fields or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please provide all required fields"
 *       409:
 *         description: Email or user handle already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Email or user handle already exists"
 *       500:
 *         description: Internal server error
 */


router.post("/admin/register", register);


/**
 * @openapi
 * /admin/login:
 *   post:
 *     summary: Admin login
 *     description: >
 *       Authenticates an admin user using email, password, and FCM token.  
 *       An admin cannot stay logged in on more than one device.  
 *       With every new login, the previous session automatically expires.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Admin@123
 *               fcmToken:
 *                 type: string
 *                 description: Firebase Cloud Messaging token for device identification
 *                 example: "d4hfgdhs7sd78sd7f7sdf8sdf8sd7f"
 *             required:
 *               - email
 *               - password
 *               - fcmToken
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/Admin'
 *                 accessToken:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI..."
 *                 refreshToken:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI..."
 *                 message:
 *                   type: string
 *                   example: "Login Successful"
 *       400:
 *         description: Bad request (missing fields / validation error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFields:
 *                 value:
 *                   error: "Please provide email and password and FCM Token"
 *               validationError:
 *                 value:
 *                   error: "Validation error message"
 *       401:
 *         description: Invalid password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Invalid password"
 *       403:
 *         description: Email not verified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Email not verified. Please check your email."
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Internal server error"
 */


router.post("/admin/login", login);

router.post("/admin/logout", authenticateToken, logout);

router.get("/admin/verifyEmail", verifyEmail);
router.post("/admin/verifyEmail", Sendverifymail);
router.post("/admin/resend-verification-mail", resendVerificationEmail);
router.get('/admin/getprofile', authenticateToken, getprofile);
router.post('/admin/update-password', updateAdminPassword);
router.post('/admin/update-profile', authenticateToken, editProfile);



module.exports = router;

//sendOTPForForgotPassword,
//verifyOtpForForgotPassword,
//checkOtp,
//updateUserPassword,
