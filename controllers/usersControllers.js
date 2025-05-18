const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");
const UnverifiedUser = require("../models/UnverifiedUserModel");
const { verifyUser } = require("../middleware/authMiddleware");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const moment = require("moment");
const Article = require("../models/Articles");
const adminModel = require("../models/admin/adminModel");
const BlacklistedToken = require('../models/blackListedToken');
const expressAsyncHandler = require("express-async-handler");
require("dotenv").config();

module.exports.register = async (req, res) => {
  try {
    const {
      user_name,
      user_handle,
      email,
      isDoctor,
      Profile_image,
      password,
      qualification,
      specialization,
      Years_of_experience,
      contact_detail,
    } = req.body;

    console.log("running");
    // Check for required fields
    if (!user_name || !user_handle || !email || !password) {
      return res
        .status(400)
        .json({ error: "Please provide all required fields" });
    }

    // Check if user already exists in User or UnverifiedUser collections

    const [existingUser, existingUserHandle, existingUnverifiedUser, existingUnverifiedUserHandle, existingAdmin] =
      await Promise.all([
        await User.findOne({ email }),
        await User.findOne({ user_handle }),
        await UnverifiedUser.findOne({ email }),
        await UnverifiedUser.findOne({ user_handle }),
        await adminModel.findOne({ email })
      ])

    if (existingUser || existingUnverifiedUser || existingAdmin) {
      return res.status(400).json({ error: "Email already in use" });
    }

    if (existingUserHandle || existingUnverifiedUserHandle) {
      return res.status(400).json({ error: "User Handle already in use" });
    }

    if (existingUnverifiedUser) {
      return res.status(400).json({
        error: "Please verify your email. Verification email already sent.",
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate a verification token
    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    console.log("Verification token : ", verificationToken);

    // Create new unverified user
    const newUnverifiedUser = new UnverifiedUser({
      user_name,
      user_handle,
      email,
      password: hashedPassword,
      isDoctor,
      contact_detail,
      Profile_image,
      verificationToken,
    });

    // Include doctor-specific fields if the user is a doctor
    if (isDoctor) {
      newUnverifiedUser.qualification = qualification;
      newUnverifiedUser.specialization = specialization;
      newUnverifiedUser.Years_of_experience = Years_of_experience;
    }

    // Save the unverified user to the database
    await newUnverifiedUser.save();

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
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

module.exports.checkUserHandle = expressAsyncHandler(

  async (req, res) => {
    const userHandle = req.body.userHandle;

    if (!userHandle) {
      return res.status(400).json({ error: "User handle is required" });
    }

    try {

      const [user, unverifiedUser, admin] = await Promise.all([
        User.findOne({ user_handle: userHandle }),
        UnverifiedUser.findOne({ user_handle: userHandle }),
        adminModel.findOne({ user_handle: userHandle })
      ])


      if (user || unverifiedUser || admin) {
        return res.status(200).json({ status: true, message: "User handle already exists" });
      }

      return res.status(200).json({ status: false, message: 'User handle is available.' });

    } catch (err) {
      console.error("Error checking user handle:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
)
module.exports.getprofile = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.userId })
      .populate({
        path: "articles",
        populate: { path: "tags" }, // Populate tags for articles
      })
      .populate({
        path: "savedArticles",
        populate: { path: "tags" }, // Populate tags for saved articles
      })
      .populate({
        path: "repostArticles",
        populate: { path: "tags" }, // Populate tags for saved articles
      })
      .exec();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!user.isVerified) {
      return res
        .status(403)
        .json({ error: "Email not verified. Please check your email." });
    }
    res.json({ status: true, profile: user });
  } catch (error) {
    console.error("Error getting user profile:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.query.id;
    const userHandle = req.query.handle;

    if (!userHandle && !userId) {
      return res.status(400).json({ error: "User handle or id is required." });
    }

    let user;

    if (userId) {

      user = await User.findById(userId)
        .populate({
          path: "articles",
          match: { status: 'published' },
          populate: { path: "tags" },
        })
        .populate({
          path: "repostArticles",
          populate: { path: "tags" },
        })
        .populate({
          path: "improvements",
          populate: { path: "tags" },
        })
        .exec();
    }
    else if (userHandle) {

      user = await User.findOne({ user_handle: userHandle }).populate({
        path: "articles",
        match: { status: 'published' },
        populate: { path: "tags" }, // Populate tags for articles
      })
        .populate({
          path: "repostArticles",
          populate: { path: "tags" }, // Populate tags for saved articles
        })
        .exec();
    }
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Exclude sensitive information
    const {
      password,
      refreshToken,
      verificationToken,
      otp,
      otpExpires,
      ...publicProfile
    } = user._doc;

    res.json({ status: true, profile: publicProfile });
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: error.message });
  }
};



module.exports.sendOTPForForgotPassword = expressAsyncHandler(
  async (req, res) => {

    try {

      const { email } = req.body;

      console.log("Email", req.body);

      const [user, admin] = await Promise.all([

        User.findOne({ email }),
        adminModel.findOne({ email }),
      ]);


      if (!user && !admin) {
        return res
          .status(400)
          .json({ message: "User with this email does not exist." });
      }

      const otp = generateOTP();
      const otpExpires = Date.now() + 10 * 60 * 60; // 10 minutes

      if (user) {
        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();
      } else {

        if (!admin.isVerified) {
          return res.status(400).json({ message: "Admin is not verified." });
        }
        admin.otp = otp;
        admin.otpExpires = otpExpires;
        await admin.save();
      }

      const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: "Password Reset OTP",
        text: `Your OTP for password reset is: ${otp}`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
          return res
            .status(500)
            .json({ message: `Error sending email.`, error: `${error}` });
        }
        res.status(200).json({ message: "OTP sent to your email.", otp: otp });
      });
    } catch (err) {

      console.log(err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

module.exports.verifyOtpForForgotPassword = expressAsyncHandler(
  async (req, res) => {
    const { email, newPassword } = req.body;

    try {

      //  const [user] = await Promise.all([
      //    User.findOne({ email }),
      // adminModel.findOne({ email })
      //  ]);

      const user = await User.findOne({ email });

      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      //   if (user) {

      const isPasswordSame = await bcrypt.compare(newPassword, user.password);
      if (isPasswordSame) {
        return res
          .status(402)
          .json({ message: "New password should not be same as old password." });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      user.password = hashedPassword;
      user.otp = null;
      user.otpExpires = null;
      await user.save();
      //  } else {

      //}

      res.status(200).json({ message: "Password reset successful." });
    } catch (err) {

      console.log(err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
)

module.exports.checkOtp = expressAsyncHandler(
  async (req, res) => {
    const { email, otp } = req.body;

    try {

      const [user, admin] = await Promise.all([
        User.findOne({ email }),
        adminModel.findOne({ email })
      ])

      if (!user && !admin) {
        return res.status(401).json({ message: "User not found" });
      }
      if (user) {

        if (user.otp !== otp || user.otpExpires < Date.now()) {
          return res.status(400).json({ message: "Invalid or expired OTP." });
        }
      } else {

        if (!admin || admin.otp !== otp || admin.otpExpires < Date.now()) {
          return res.status(400).json({ message: "Invalid or expired OTP." });
        }
      }


      res.status(200).json({ message: "OTP is valid." });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

module.exports.login = async (req, res) => {
  try {
    const { email, password, fcmToken } = req.body;

    if (!email || !password || !fcmToken) {
      return res
        .status(400)
        .json({ error: "Please provide email and password and FCM Token" });
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = await UnverifiedUser.findOne({ email });
      if (!user) return res.status(404).json({ error: "User not found" });
      return res
        .status(403)
        .json({ error: "Email not verified. Please check your email." });
    }

    if (!user.isVerified) {
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
    console.log("Generated Token:", accessToken);
    console.log("Generated Refresh Token", refreshToken);
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
};

module.exports.logout = async (req, res) => {


  try {
    // Find the user and remove the refresh token
    const user = await User.findById(req.userId);


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

module.exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token required" });
  }

  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Check if the refresh token is valid and associated with the user
    const user = await User.findOne({ _id: decoded.userId, refreshToken });
    if (!user) {
      return res.status(403).json({ error: "Invalid refresh token" });
    }

    // Generate a new access token
    const newAccessToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // Optionally, generate a new refresh token
    const newRefreshToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Update the refresh token in the database
    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      maxAge: 900000,
    }); // 15 minutes
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      maxAge: 604800000,
    }); // 7 days

    res
      .status(200)
      .json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(403).json({ error: "Invalid refresh token" });
  }
};

module.exports.deleteByUser = async (req, res) => {
  let token;
  if (req.cookies && req.cookies["token"]) {
    token = req.cookies["token"];
  } else {
    token = req.headers.authorization?.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Authorization token missing" });
  }
  try {
    const { password } = req.body;
    const email = await verifyUser(token);
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ error: "Email not verified. Please check your email." });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid password" });
    }
    console.log("email : ", email + " password  : ", password);
    await User.deleteOne({ email });
    res.json({
      status: true,
      message: "account has been removed from database",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports.deleteByAdmin = async (req, res) => {
  try {
    const { adminEmail, adminPassword, userEmail } = req.body;
    const admin = await adminModel.findOne({ email: adminEmail });
    if (!admin) res.status(404).json({ message: "user not found" });
    else {
      console.log(admin);
      const validAdimin = await bcrypt.compare(
        adminPassword,
        admin.adminPassword
      );
      if (!validAdimin) res.status(404).json({ message: "password not match" });
      else {
        const result = await User.deleteOne({ email: userEmail });
        res.json({ messge: "user delerted sucessfully", result });
      }
    }
  } catch (error) {
    res.json({ messge: error.message });
  }
};
// follow a user

module.exports.follow = async (req, res) => {
  try {
    const { articleId, followUserId } = req.body;

    // Check if user is trying to follow themselves
    if (!articleId && !followUserId) {
      return res.status(400).json({ error: "Article id or follow user id are required" });
    }

    let article;
    if (articleId) {
      article = await Article.findById(Number(articleId));
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
    }


    if (article && req.userId === article.authorId) {
      return res
        .status(400)
        .json({ message: "You cannot follow or unfollow yourself" });
    }

    // Find the user who is following
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Find the user to be followed

    let userToFollow;

    if (article) {
      userToFollow = await User.findById(article.authorId);
    }
    else {
      userToFollow = await User.findById(followUserId);
    }

    if (!userToFollow)
      return res.status(404).json({ message: "User to follow not found" });

    if(userToFollow.isBlockUser|| userToFollow.isBannedUser) {
      return res.status(400).json({ message: "User to follow is blocked or banned"});
    }

    if(user.isBlockUser || user.isBannedUser) {
      return res.status(400).json({ message: "You are blocked or banned"});
    }

    // Filter out null values and convert to strings
    const followerUserset = new Set(
      userToFollow.followers.filter((id) => id).map((id) => id.toString())
    );
    const followingUserSet = new Set(
      user.followings.filter((id) => id).map((id) => id.toString())
    );

    //console.log("USER ID", req.userId.toString());
    // console.log("AUTHOR ID", article.authorId.toString());
    // console.log("Follower User Set", followerUserset);
    // console.log("Following User Set", followingUserSet);
    // console.log("Condition 1 ", followerUserset.has(req.userId.toString()));
    // console.log("Condition 2 ", followingUserSet.has(article.authorId.toString()));
    if (
      followerUserset.has(req.userId.toString()) ||
      followingUserSet.has(userToFollow._id.toString())
    ) {
      // Unfollow
      user.followings = user.followings.filter(
        (id) => id.toString() !== userToFollow._id.toString()
      );
      user.followingCount = Math.max(0, user.followingCount - 1);
      await user.save();

      userToFollow.followers = userToFollow.followers.filter(
        (id) => id && id.toString() !== req.userId.toString()
      );
      userToFollow.followerCount = Math.max(0, userToFollow.followerCount - 1);
      await userToFollow.save();
      res.json({ message: "Unfollow successfully", followStatus: false });
    } else {
      // Follow
      user.followings.push(userToFollow._id);
      user.followingCount += 1;
      await user.save();

      userToFollow.followers.push(req.userId);
      userToFollow.followerCount += 1;
      await userToFollow.save();
      res.json({ message: "Follow successfully", followStatus: true });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Follower

module.exports.getFollowers = async (req, res) => {
  const userId = req.userId;
  const author = await User.findById(userId).
    populate({
      path: "followers",
      select: "user_id user_name followers Profile_image",
    }).exec();

  if (!author) {
    return res.status(404).json({ error: "Author not found" });
  }
  return res.status(200).json({ followers: author.followers });
};

// GET followings
module.exports.getFollowings = async (req, res) => {
  const userId = req.userId;
  const author = await User.findById(userId).
    populate({
      path: "followings",
      select: "user_id user_name followers Profile_image",
    }).exec();

  if (!author) {
    return res.status(404).json({ error: "Author not found" });
  }
  return res.status(200).json({ followers: author.followings });
};

// GET socials
// type : 1 for followers, 2 for followings, 3 for contributors
module.exports.getSocials = async (req, res) => {

  const { type, articleId, social_user_id } = req.query;

  if (articleId) {
    const article = await 
    Article.findById(Number(articleId))
    .populate({
      path: "contributors",
      select: "user_id user_name followers Profile_image",
    }).
    exec();

    return res.status(200).json({followers: article.contributors});
  }
  let id = social_user_id? social_user_id:req.userId;
  const author = await User.findById(id).
    populate({
      path: "followings",
      select: "user_id user_name followers Profile_image",
    })
    .populate({
      path: "followers",
      select: "user_id user_name followers Profile_image",
    })
    .exec();

  if (!author) {
    return res.status(404).json({ error: "Author not found" });
  }

  if (Number(type) === 1) {
    return res.status(200).json({ followers: author.followers });
  }

  else if (Number(type) == 2) {
    return res.status(200).json({ followers: author.followings });
  }

  else if (Number(type) == 3) {
    return res.status(200).json({ followers: author.contributors });
  }

  else {
    return res.status(404).json({ error: "Invalid type" });
  }

};

module.exports.getProfileImage = async (req, res) => {
  const userId = req.params.userId;
  const author = await User.findById(userId);

  if (!author) {
    return res.status(404).json({ error: 'Author not found' });
  }

  return res.status(200).json({ profile_image: author.Profile_image });

}

// get User Articles,
module.exports.getUserWithArticles = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("articles").exec(); // Populate  articles

    if (!user) {
      return res.status(400).json({ message: "user not found" });
    }
    return res.status(200).json({ message: "Articles", data: user });
  } catch (error) {
    console.log("Get User Articles Error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// get user like and save articles
module.exports.getUserLikeAndSaveArticles = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate("likedArticles") // Populate liked articles
      .populate("savedArticles"); // Populate saved articles

    if (!user) {
      return res.status(400).json({ message: "user not found" });
    }
    return res
      .status(200)
      .json({ message: "Like and Save Articles", data: user });
  } catch (error) {
    console.log("Get User Articles Error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

//update read article
/*
module.exports.updateReadArticles = async (req, res) => {
  try {
    const { userId, articleId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.readArticles.push({
      articleId: Number(articleId),
      readingDate: new Date(),
    });
    await user.save();

    res.status(200).json({ message: "Article read recorded successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error updating read articles", details: error.message });
  }
};
*/


/*
//This endpoint returns the number of articles read by the user daily for a given month.
module.exports.collectMonthlyRecordsForReading = async (req, res) => {
  try {
    const { userId, month } = req.query;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const startOfMonth = moment(month, "MM-YYYY").startOf("month");
    const endOfMonth = moment(month, "MM-YYYY").endOf("month");

    const records = user.readArticles.filter((record) =>
      moment(record.readingDate).isBetween(startOfMonth, endOfMonth)
    );

    const dailyRecords = {};
    records.forEach((record) => {
      const date = moment(record.readingDate).format("DD-MM-YY");
      if (dailyRecords[date]) {
        dailyRecords[date]++;
      } else {
        dailyRecords[date] = 1;
      }
    });

    res.status(200).json({
      status: true,
      data: Object.keys(dailyRecords).map((date) => ({
        articleReadCount: dailyRecords[date],
        date,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: "Error fetching reading records",
      details: error.message,
    });
  }
};

//This endpoint returns the list of articles written by the user in a given month.

module.exports.collectMonthlyRecordsForWriting = async (req, res) => {
  try {
    const { userId, month } = req.query;

    const startOfMonth = moment(month, "MM-YYYY").startOf("month");
    const endOfMonth = moment(month, "MM-YYYY").endOf("month");

    const articles = await Article.find({
      authorId: userId,
      published_date: { $gte: startOfMonth, $lt: endOfMonth },
    })
      .populate("tags") // This populates the tag data
      .exec();

    const dailyRecords = {};
    articles.forEach((article) => {
      const date = moment(article.published_date).format("DD-MM-YY");
      if (dailyRecords[date]) {
        dailyRecords[date]++;
      } else {
        dailyRecords[date] = 1;
      }
    });

    res.status(200).json({
      status: true,
      data: Object.keys(dailyRecords).map((date) => ({
        articlePostCount: dailyRecords[date],
        date,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: "Error fetching writing records",
      details: error.message,
    });
  }
};
*/
module.exports.updateProfileImage = async (req, res) => {
  try {
    const { profileImageUrl } = req.body;

    if (!profileImageUrl) {
      res
        .status(400)
        .json({ error: "User ID and profile image URL are required." });
      return;
    }

    console.log(req.userId);
    // Find the user in the User collection
    let user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Update the profile image URL
    user.Profile_image = profileImageUrl;
    // Save the updated user document
    await user.save();

    res.status(200).json({
      message: "Profile image updated successfully.",
      Profile_image: profileImageUrl,
    });
  } catch (error) {
    console.error("Error updating profile image:", error);
    // Handle general server errors
    res.status(500).json({ error: "Internal server error" });
  }
};

// get user details
module.exports.getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Exclude sensitive information
    const {
      password,
      refreshToken,
      verificationToken,
      otp,
      otpExpires,
      followingCount,
      followerCount,
      followers,
      followings,
      articles,
      last_updated_at,
      likedArticles,
      readArticles,
      savedArticles,
      repostArticles,
      improvements,
      created_at,
      ...publicProfile
    } = user._doc;

    res.json({ status: true, profile: publicProfile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// update user general details
module.exports.updateUserGeneralDetails = async (req, res) => {
  try {
    const userId = req?.user?.userId;
    const { username, userHandle, email, about } = req.body;

    // Validate input fields
    if (!username || !userHandle || !email || !about) {
      return res
        .status(400)
        .json({ error: "Please provide all required fields" });
    }


    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the email is already in use by another user (excluding the current user)
    const emailExists = await User.findOne({
      contact_detail: { email: email },
      email: email,
      _id: { $ne: userId },
    });
    if (emailExists) {
      return res.status(400).json({ error: "Email already in use" });
    }

    // Check if the user handle is already in use by another user (excluding the current user)
    const userHandleExists = await User.findOne({
      user_handle: userHandle,
      _id: { $ne: userId },
    });
    if (userHandleExists) {
      return res.status(400).json({ error: "User handle already in use" });
    }

    // Update user details
    user.user_name = username;
    user.user_handle = userHandle;
    user.email = email;
    user.about = about;
    await user.save();

    // Respond with success
    res.json({ status: true, message: "User details updated successfully" });
  } catch (error) {
    console.error("Error during updating user details:", error);

    // Handle duplicate email/user handle error
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: "Email or user handle already exists" });
    }

    // Handle Mongoose validation errors
    if (error instanceof mongoose.Error.ValidationError) {
      const validationErrors = Object.values(error.errors).map(
        (val) => val.message
      );
      return res.status(400).json({ errors: validationErrors });
    }

    // Handle general server errors
    res.status(500).json({ error: "Internal server error" });
  }
};

// update user contact details
module.exports.updateUserContactDetails = async (req, res) => {
  try {
    const userId = req?.user?.userId;
    const { phone, email } = req.body;

    // Validate input fields
    if (!email || !phone) {
      return res
        .status(400)
        .json({ error: "Please provide all required fields" });
    }

    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the email is already in use by another user (excluding the current user) contact_detail: {email_id:email},
    const emailExists = await User.findOne({
      email: email,
      _id: { $ne: userId },
    });
    if (emailExists) {
      return res.status(400).json({ error: "Email already in use" });
    }
    const contactEmailExists = await User.findOne({
      "contact_detail.email_id": email,
      _id: { $ne: userId },
    });

    if (contactEmailExists) {
      return res.status(400).json({ error: "Email already in use" });
    }

    console.log(contactEmailExists);
    const phoneNumerExists = await User.findOne({
      "contact_detail.phone_no": phone,
      _id: { $ne: userId },
    });
    if (phoneNumerExists) {
      return res.status(400).json({ error: "Phone Numer already in use" });
    }

    // Update user details
    user.contact_detail.email_id = email;
    user.contact_detail.phone_no = phone;
    await user.save();

    // Respond with success
    res.json({ status: true, message: "User contact updated successfully" });
  } catch (error) {
    console.error("Error during updating user details:", error);

    // Handle duplicate email/user handle error
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: "Email or user handle already exists" });
    }

    // Handle Mongoose validation errors
    if (error instanceof mongoose.Error.ValidationError) {
      const validationErrors = Object.values(error.errors).map(
        (val) => val.message
      );
      return res.status(400).json({ errors: validationErrors });
    }

    // Handle general server errors
    res.status(500).json({ error: "Internal server error" });
  }
};

// update user Professional details
module.exports.updateUserProfessionalDetails = async (req, res) => {
  try {
    const userId = req?.user?.userId;

    const { specialization, qualification, experience } = req.body;

    // Validate input fields
    if (!specialization || !qualification || !experience) {
      return res
        .status(400)
        .json({ error: "Please provide all required fields" });
    }

    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user details
    user.specialization = specialization;
    user.qualification = qualification;
    user.Years_of_experience = experience;
    await user.save();

    // Respond with success
    res.json({ status: true, message: "User details updated successfully" });
  } catch (error) {
    console.error("Error during updating user details:", error);
    // Handle general server errors
    res.status(500).json({ error: "Internal server error" });
  }
};

// update user password
module.exports.updateUserPassword = expressAsyncHandler(
  async (req, res) => {
    try {
      //  const userId = req?.userId;
      const { old_password, new_password, userId } = req.body;

      // Check if both old and new passwords are provided
      if (!old_password || !new_password || !userId) {
        return res.status(400).json({ error: "Missing passwords and user id" });
      }

      // Check if the new password is long enough
      if (new_password.length < 6) {
        return res.status(400).json({ error: "Password too short" });
      }

      // Find the user by ID
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if the old password matches the stored password
      const isOldPasswordValid = await bcrypt.compare(
        old_password,
        user.password
      );
      if (!isOldPasswordValid) {
        return res.status(401).json({ error: "Invalid old password" });
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


