const nodemailer = require('nodemailer');
require('dotenv').config();
const { verifyToken, verifyUser } = require("../middleware/authMiddleware");
const jwt = require('jsonwebtoken');
const UnverifiedUser = require("../models/UnverifiedUserModel");
const User = require("../models/UserModel");
const admin = require("../models/admin/adminModel");
const cache = require('memory-cache');

const cooldownTime = 3600;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendVerificationEmail = (email, token) => {

    const url = `${process.env.BASE_URL}api/user/verifyEmail?token=${token}`;
    console.log("URL", url);
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Email Verification',
        html: `<h3>Please verify your email by clicking the link below:</h3><a href="${url}">${url}</a>`,
    };

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error('Error sending email:', err);
        } else {
            console.log('Verification email sent:', info.response);
        }
    });
};

const Sendverifymail = async (req, res) => {
    const { email, token, isAdmin } = req.body;

    if (!email || !token) {
        return res.status(400).json({ message: 'Email and token are required' });
    }

    let user;
    if (isAdmin) {
        user = await admin.findOne({ email });
    } else {
        user = await UnverifiedUser.findOne({ email: email });
    }

    const cooldownKey = `verification-email:${email}`;

    if (cache.get(cooldownKey)) {
        return res.status(429).json({ message: 'Verification email already sent' });
    }

    cache.put(cooldownKey, 'true', cooldownTime * 1000); // store for 1 hour

    if (!user || user.isVerified) {
        return res.status(400).json({ message: 'User not found or already verified' });
    } else {
        sendVerificationEmail(email, token);
    }

    res.status(200).json({ message: 'Verification email sent' });
};


const resendVerificationEmail = async (req, res) => {
    const { email, isAdmin } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    let user;

    if (isAdmin) {
        user = await admin.findOne({ email });
    } else {
        user = await UnverifiedUser.findOne({ email: email });
    }

    if (!user || user.isVerified) {
        return res.status(400).json({ message: 'User not found or already verified' });
    }

    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    sendVerificationEmail(email, verificationToken);

    const cooldownKey = `resend-verification-email:${email}`;

    if (cache.get(cooldownKey)) {
        return res.status(429).json({ message: 'Verification email already sent' });
    }

    cache.put(cooldownKey, 'true', cooldownTime * 1000); // store for 1 hour

    res.status(200).json({ message: 'Verification email sent' });
};

//verify email functionality
const verifyEmail = async (req, res) => {
    const { token, isAdmin } = req.query;

    if (!token) {
        return res.status(400).json({ error: 'Token is missing' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (isAdmin) {
            const user = await admin.findOne({ email: decoded.email });

            if (!user) {
                return res.status(201).json({ message: 'Admin user not found, register yourself first' });
            }

            user.isVerified = true;
            await user.save();
        }
        else {

            const unverifiedUser = await UnverifiedUser.findOne({ email: decoded.email });

            if (!unverifiedUser) {
                return res.status(201).json({ message: 'Either email already verified or register yourself first' });
            }

            // Move user from UnverifiedUser to User collection
            const newUser = new User({
                user_name: unverifiedUser.user_name,
                user_handle: unverifiedUser.user_handle,
                email: unverifiedUser.email,
                password: unverifiedUser.password,
                isDoctor: unverifiedUser.isDoctor,
                specialization: unverifiedUser.specialization,
                qualification: unverifiedUser.qualification,
                Years_of_experience: unverifiedUser.Years_of_experience,
                contact_detail: unverifiedUser.contact_detail,
                Profile_image: unverifiedUser.Profile_image,
                isVerified: true
            });

            await newUser.save();
            await UnverifiedUser.deleteOne({ email: unverifiedUser.email });
        }

        // Respond with an HTML page
        res.send(`
            <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verified</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f0f8ff;
            color: #333;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .container {
            background-color: white;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            padding: 40px;
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        .logo {
            width: 100px;
        }
        h1 {
            color: #007BFF;
            margin-top: 0px;
        }

        h4 {
            font-size: 18px;
            color: #666;
        }
        p {
            font-size: 15px;
            color: #666;
        }
        .button {
            background-color: #007BFF;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            text-decoration: none;
            font-size: 16px;
            cursor: pointer;
              }
    </style>
</head>
<body>
    <div class="container">
        <img src="https://imgur.com/I5lDXoI.png" alt="Logo" class="logo">
        <h1>Welcome ✅</h1>
        <h4>Your account has been verified successfully.</h4>
        <!-- <button onclick="openApp()">Open Your App</button> -->
        <p>You can now close this page </p>
    </div>

    <script>
        function openApp() {
            var appScheme = 'your-app-scheme://';
            var appStoreUrl = 'your-app-store-url';

            var start = new Date().getTime();
            var timeout;

            function checkOpen() {
                var end = new Date().getTime();
                if (end - start < 1500) { // Adjust the timeout duration as needed
                    window.location.href = appStoreUrl;
                }
            }

            window.location = appScheme;
            timeout = setTimeout(checkOpen, 1000);
        }
    </script>
</body>
</html>
        `);
    } catch (error) {
        console.error('Error verifying email:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const sendArticleFeedbackEmail = (email, feedback, title) => {

  
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `New Feedback on Your Article: ${title}`,
        html: `<html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            color: #333;
                            line-height: 1.6;
                            margin: 0;
                            padding: 0;
                            background-color: #f4f7fc;
                        }
                        .container {
                            width: 80%;
                            margin: 0 auto;
                            background-color: #ffffff;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        }
                        .header {
                            background-color: #00BFFF;
                            color: white;
                            padding: 15px;
                            border-radius: 8px 8px 0 0;
                            text-align: center;
                        }
                        .header h1 {
                            font-size: 24px;
                            margin: 0;
                        }
                        .content {
                            padding: 20px;
                        }
                        .footer {
                            text-align: center;
                            font-size: 14px;
                            color: #777;
                            padding: 10px;
                        }
                        .note {
                            background-color: #ffecb3;
                            padding: 10px;
                            border-left: 5px solid #ffb300;
                            margin-top: 20px;
                        }
                        .btn {
                            background-color: #28a745;
                            color: white;
                            padding: 10px 20px;
                            border-radius: 5px;
                            text-decoration: none;
                            display: inline-block;
                            margin-top: 20px;
                        }
                        .btn:hover {
                            background-color: #218838;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1> Feedback for "${title}"</h1>
                        </div>
                        <div class="content">
                            <p>Dear Author,</p>
                            <p>I hope this message finds you well!</p>
                            <p>We have reviewed your article titled "<strong>${title}</strong>" and would like to provide some feedback:</p>

                            <p><strong>Feedback:</strong></p>
                            <p>${feedback}</p>

                            <p>We believe your article has great potential, and with a few adjustments, it will be even more impactful. Please review the feedback and feel free to reach out if you need further clarification.</p>

                            <div class="note">
                                <p><strong>Note:</strong> If no action is taken within 4 days, the article will automatically be discarded from our review process.</p>
                            </div>

                            <p>We look forward to your revised article. Please don't hesitate to get in touch if you have any questions!</p>
        
                        </div>
                        <div class="footer">
                            <p>Best regards,<br>UltimateHealth Team</p>
                        </div>
                    </div>
                </body>
            </html>`,
    };

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error('Error sending email:', err);
        } else {
            console.log('Verification email sent:', info.response);
        }
    });
};

module.exports = { sendVerificationEmail, verifyEmail, Sendverifymail, resendVerificationEmail, sendArticleFeedbackEmail };



