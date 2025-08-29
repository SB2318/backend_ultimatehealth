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

/**
 * @openapi
 * /admin/logout:
 * 
 *   post:
 *     summary: Logout admin
 *     description: Logs out the currently authenticated user by blacklisting the refresh token and clearing cookies.
 *     tags: [Admin]
 *     security:
 *      - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logout successful
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */


router.post("/admin/logout", authenticateToken, logout);


/**
 * @openapi
 * /admin/verifyEmail:
 *   get:
 *     summary: Verify Email
 *     description: |
 *       This endpoint verifies the email address of a user or an admin based on the provided verification token.
 *       
 *       - If `isAdmin=true`, it verifies the email of an existing admin account by marking it as verified.
 *       - If `isAdmin=false` or not provided, it verifies a regular user by migrating them from the UnverifiedUser collection to the verified User collection.
 *       
 *       This process ensures that the email is valid, registered, and belongs to a real user. It helps confirm the authenticity of the account.
 *       A successful verification returns a confirmation HTML page.
 *     tags:
 *       [Admin]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: JWT token received via email for account verification.
 *       - in: query
 *         name: isAdmin
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Optional flag to indicate if the verification is for an admin.
 *     responses:
 *       200:
 *         description: Email verified successfully – returns an HTML confirmation page.
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html><body>Email Verified</body></html>"
 *       201:
 *         description: Informational response – user not found or already verified.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Admin user not found, register yourself first
 *       400:
 *         description: Missing token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Token is missing
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */

router.get("/admin/verifyEmail", verifyEmail);

/**
 * @openapi
 * /admin/verifyEmail:
 *   post:
 *     summary: Send verification email
 *     description: |
 *       Sends a verification email to either a new user or an admin after registration.
 *       
 *       - Accepts an email and a JWT token.
 *       - If `isAdmin=true`, it targets an existing admin account.
 *       - If `isAdmin=false` or not provided, it targets a user in the UnverifiedUser collection.
 *       - Implements a cooldown mechanism to prevent multiple verification emails from being sent within a short time window (1 hour). This helps avoid spamming the user's inbox and reduces unnecessary email traffic.
 *       - During this 1 hour, you cannot request a new verification email.
 *
 *     tags: [Admin]
 *   
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - token
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               token:
 *                 type: string
 *                 example: your.jwt.token.here
 *               isAdmin:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Verification email sent successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Verification email sent
 *       400:
 *         description: Missing required fields or user not found/already verified.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User not found or already verified
 *       429:
 *         description: Rate limit – verification email already sent recently.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Verification email already sent
 */

router.post("/admin/verifyEmail", Sendverifymail);

/**
 * @openapi
 * /admin/resend-verification-mail:
 *   post:
 *     summary: Resend verification email
 *     description: |
 *       This endpoint allows users or admins to request a new verification email in case the original link was missed, expired, or not received.
 *       
 *       - This is only applicable to accounts that are not yet verified.
 *       - If the account is already verified, the request will be rejected.
 *       - A new verification token is generated and sent via email.
 *       
 *       This feature is helpful when users are unable to access the application due to unverified email status. However, to prevent abuse or email spamming, a cooldown period is enforced.
 *       
 *       **Cooldown Rule:** Once a verification email is sent, you must wait 1 hour before requesting another one.
 *     
 *     tags: [Admin]
 *       
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               isAdmin:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Verification email sent successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Verification email sent
 *       400:
 *         description: User not found or already verified.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User not found or already verified
 *       429:
 *         description: Too many requests — verification email already sent recently.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Verification email already sent
 */

router.post("/admin/resend-verification-mail", resendVerificationEmail);

/**
 * @openapi
 * /admin/getprofile:
 *   get:
 *     summary: Get admin profile
 *     description: |
 *       Retrieves the profile information of the currently authenticated admin user.
 *       
 *       - Requires a valid JWT access token in the Authorization header.
 *       - The user's email must be verified to access this route.
 *       - Returns user details if authenticated and verified.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved admin profile.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Admin'
 *       403:
 *         description: Email not verified.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Email not verified. Please check your email.
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User not found
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */

router.get('/admin/getprofile', authenticateToken, getprofile);

/**
 * @openapi
 * /admin/update-password:
 *   post:
 *     summary: Update admin password
 *     description: |
 *       Allows an admin to update their password using their email address.
 *       
 *       - The new password must be at least 6 characters long.
 *       - The new password must not be the same as the current one.
 *       - Returns an error if the email is not associated with any admin.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - new_password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               new_password:
 *                 type: string
 *                 format: password
 *                 example: NewPassword123
 *     responses:
 *       200:
 *         description: Password updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password updated
 *       400:
 *         description: Bad request (e.g. missing fields, same password, too short).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Password too short
 *       404:
 *         description: Admin not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: User not found
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Server error
 */
router.post('/admin/update-password', updateAdminPassword);

/**
 * @openapi
 * /admin/update-profile:
 *   post:
 *     summary: Update admin profile
 *     description: |
 *       Allows an authenticated admin to update their profile details such as name, handle, avatar, and password.
 *       
 *       - Requires a valid JWT token in the Authorization header.
 *       - All fields are optional except for the new password, which must be different from the current one.
 *       - If the new password matches the old one, the request will be rejected.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               user_name:
 *                 type: string
 *                 example: John Doe
 *               user_handle:
 *                 type: string
 *                 example: johndoe123
 *               profile_avtar:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/avatar.jpg
 *               password:
 *                 type: string
 *                 format: password
 *                 example: NewSecurePassword123
 *     responses:
 *       200:
 *         description: Profile updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Profile updated
 *       400:
 *         description: New password is the same as the old password.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Same as old password
 *       401:
 *         description: Unauthorized – missing or invalid token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 *       404:
 *         description: Admin user not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: User not found
 *       500:
 *         description: Server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Server error
 */

router.post('/admin/update-profile', authenticateToken, editProfile);



module.exports = router;


