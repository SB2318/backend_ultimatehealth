// moderator registration
// moderator verification
// moderator and admin login
// moderator and admin logout
// moderator account deletion
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const expressAsyncHandler = require("express-async-handler");
const admin = require('../../models/admin/adminModel')
const BlacklistedToken = require('../../models/blackListedToken');
const jwt = require("jsonwebtoken");
const User = require("../../models/UserModel");
const Article = require('../../models/Articles');
const statusEnum = require("../../utils/StatusEnum");
const UnverifiedUser = require('../../models/UnverifiedUserModel');
const AdminAggregate = require('../../models/events/adminContributionEvent');


module.exports.register = expressAsyncHandler(
  async (req, res) => {
    try {
      const {
        user_name,
        user_handle,
        email,
        Profile_avtar,
        password,
      } = req.body;

      // Check for required fields
      if (!user_name || !user_handle || !email || !password) {
        return res
          .status(400)
          .json({ error: "Please provide all required fields" });
      }

      // Check if user already exists in User or UnverifiedUser collections

      const [existingAdmin, existingUserHandle, existingUser, existingUnverifiedUser] =
        await Promise.all([
          await admin.findOne({ email }),
          await admin.findOne({ user_handle }),
          await User.findOne({ email }),
          await UnverifiedUser.findOne({ email })
        ])

      if (existingUser || existingAdmin || existingUserHandle || existingUnverifiedUser) {
        return res.status(400).json({ error: "Email already in use" });
      }

      if (existingUserHandle) {
        return res.status(400).json({ error: "User Handle already in use" });
      }


      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Generate a verification token
      const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });

      // Create new unverified user
      const adminuser = new admin({
        user_name,
        user_handle,
        email,
        password: hashedPassword,
        Profile_avtar,
        verificationToken,
      });

      await adminuser.save();

      // Send verification email
      // sendVerificationEmail(email, verificationToken);

      res.status(201).json({
        message: "Registration successful. Please verify your email.",
        token: verificationToken,
      });

    } catch (error) {
      console.error("Error during registration:", error);

      // Handle validation errors
      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (val) => val.message
        );
        return res.status(400).json({ errors: validationErrors });
      }

      // Handle duplicate email/user handle error
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ error: "Email or user handle already exists" });
      }

      // Handle general server errors
      res.status(500).json({ error: "Internal server error" });
    }
  }
)

module.exports.login = expressAsyncHandler(
  async (req, res) => {
    try {
      const { email, password, fcmToken } = req.body;

      if (!email || !password || !fcmToken) {
        return res
          .status(400)
          .json({ error: "Please provide email and password and FCM Token" });
      }

      let user = await admin.findOne({ email });


      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.isVerified === false) {
        return res
          .status(403)
          .json({ error: "Email not verified. Please check your email." });
      }


      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid password" });
      }

      // Blacklist the token
      if (user.refreshToken != null) {
        const blacklistedToken = new BlacklistedToken({ token: user.refreshToken });
        await blacklistedToken.save();
      }

      // Generate JWT Access Token
      const accessToken = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "15m" } // Short-lived access token
      );

      // Generate Refresh Token
      const refreshToken = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" } // Longer-lived refresh token
      );

      // Store refresh token in the database
      user.refreshToken = refreshToken;
      user.fcmToken = fcmToken;
      await user.save();

      // Set cookies for tokens
      res.cookie("accessToken", accessToken, { httpOnly: true, maxAge: 900000 }); // 15 minutes
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        maxAge: 604800000,
      }); // 7 days

      res
        .status(200)
        .json({ user, accessToken, refreshToken, message: "Login Successful" });
    } catch (error) {
      console.log("Login Error", error);

      if (error.name === "ValidationError") {
        return res.status(400).json({ error: error.message }); // Validation errors
      } else {
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  }
)

module.exports.logout = expressAsyncHandler(
  async (req, res) => {

    try {
      // Find the user and remove the refresh token
      const user = await admin.findById(req.userId);

      if (user) {
        // BlackList the token first
        const blacklistedToken = new BlacklistedToken({ token: user.refreshToken });
        await blacklistedToken.save();
        user.refreshToken = null;
        await user.save();
      }

      // Clear cookies
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");

      res.status(200).json({ message: "Logout successful" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
)

module.exports.getprofile = expressAsyncHandler(
  async (req, res) => {
    try {
      const user = await admin.findById(req.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (!user.isVerified) {
        return res
          .status(403)
          .json({ error: "Email not verified. Please check your email." });
      }

      //const articleContributed = await Article.countDocuments({ reviewer_id: user._id, status: statusEnum.statusEnum.PUBLISHED });


      return res.json(user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }

  }
)

// update user password
module.exports.updateAdminPassword = expressAsyncHandler(
  async (req, res) => {
    try {
      //const userId = req?.userId;
      const { new_password, email } = req.body;

      // Check if both old and new passwords are provided
      if (!new_password || !email) {
        return res.status(400).json({ error: "Missing passwords and email" });
      }

      // Check if the new password is long enough
      if (new_password.length < 6) {
        return res.status(400).json({ error: "Password too short" });
      }

      // Find the user by ID
      const user = await admin.findOne({ email });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }


      // Ensure the new password is not the same as the old password
      const isSameAsOldPassword = await bcrypt.compare(
        new_password,
        user.password
      );
      if (isSameAsOldPassword) {
        return res.status(400).json({ error: "Same as old password" });
      }

      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const newHashedPassword = await bcrypt.hash(new_password, salt);

      // Update the user's password
      user.password = newHashedPassword;
      await user.save();
      res.json({ status: true, message: "Password updated" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Edit profile: user_name, user_handle, password, profile_avtar

module.exports.editProfile = expressAsyncHandler(
  async (req, res) => {

    const { user_name, user_handle, password, profile_avtar } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {

      const user = await admin.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      user.user_name = user_name || user.user_name;
      user.user_handle = user_handle || user.user_handle;
      user.profile_avtar = profile_avtar || user.profile_avtar;
      // encrypt password
      const isSameAsOldPassword = await bcrypt.compare(
        password,
        user.password
      );
      if (isSameAsOldPassword) {
        return res.status(400).json({ error: "Same as old password" });
      }

      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const newHashedPassword = await bcrypt.hash(password, salt);

      // Update the user's password
      user.password = newHashedPassword;
      await user.save();

      res.status(200).json({ status: true, message: "Profile updated" });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
)

module.exports.logout = async (req, res) => {

  try {
    // Find the user and remove the refresh token
    const user = await admin.findById(req.userId);
    if (user) {
      // BlackList the token first
      const blacklistedToken = new BlacklistedToken({ token: user.refreshToken });
      await blacklistedToken.save();
      user.refreshToken = null;
      await user.save();
    }
    // Clear cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
// Later: Delete  profile images from AWS

