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
      
          const [existingUser, existingUserHandle] =
          await Promise.all([
            await admin.findOne({ email }),
            await admin.findOne({user_handle}),
          ])
      
          if (existingUser) {
            return res.status(400).json({ error: "Email already in use" });
          }
      
          if(existingUserHandle){
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
    
          if(user.isVerified === false){
            return res
            .status(403)
            .json({ error: "Email not verified. Please check your email." });
          }
      
      
          const isPasswordValid = await bcrypt.compare(password, user.password);
          if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid password" });
          }
      
          // Blacklist the token
          if(user.refreshToken != null){
            const blacklistedToken = new BlacklistedToken({ token:  user.refreshToken });
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
          const user = await admin.findById(req.user.userId);
    
          if (user) {
            // BlackList the token first
            const blacklistedToken = new BlacklistedToken({ token:  user.refreshToken });
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
    try{
      const user = await admin.findById(req.user.userId);
      if(!user) return res.status(404).json({ message: "User not found"});
      if (!user.isVerified) {
        return res
          .status(403)
          .json({ error: "Email not verified. Please check your email." });
      }

      return res.json({ status: true, profile: user });
    }catch(err){
       console.error(err);
       res.status(500).json({error: "Internal server error"});
    }

  }
)