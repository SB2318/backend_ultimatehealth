const nodemailer = require('nodemailer');
require('dotenv').config();
const { verifyToken, verifyUser } = require("../middleware/authMiddleware");
const { ARTICLE_FEEDBACK, ARTICLE_PUBLISH, ARTICLE_DISCARDED_FROM_SYSTEM, ARTICLE_DISCARDED_IN_REVIEW_STATE_NO_ACTION, PODCAST_PUBLISH, PODCAST_DISCARDED_FROM_SYSTEM, PODCAST_DISCARDED } = require("../utils/emailBody");
const jwt = require('jsonwebtoken');
const UnverifiedUser = require("../models/UnverifiedUserModel");
const User = require("../models/UserModel");
const admin = require("../models/admin/adminModel");
const cache = require('memory-cache');
const statusEnum = require("../utils/StatusEnum");
const cooldownTime = 3600;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationEmail = (email, token, isAdmin) => {

  const url = `${process.env.BASE_URL}api/user/verifyEmail?token=${token}&isAdmin=${isAdmin}`;
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
    sendVerificationEmail(email, token, isAdmin);
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
  sendVerificationEmail(email, verificationToken, isAdmin);

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

// Later will centralize all email body, once the thing is integrated in frontend
const sendArticlePublishedEmail = (email, articleLink, title) => {


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
                background-color: #e7f4e7;
                padding: 10px;
                border-left: 5px solid #28a745;
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
                <h1>Article Published: ${title}</h1>
            </div>
            <div class="content">
                <p>Dear Author,</p>
                <p>We are excited to inform you that your article titled "<strong>${title}</strong>" has been successfully published on UltimateHealth!</p>

                <p>Your work is now live for our readers to enjoy, and we are thrilled to share your insights with the community. We sincerely appreciate the effort you’ve put into this article and hope it resonates with many!</p>

                <div class="note">
                    <p><strong>Note:</strong> You can view your article by following this <a href="${articleLink}" class="btn">link</a>.</p>
                </div>

                <p>Thank you for contributing to UltimateHealth. If you have any questions or need further assistance, don’t hesitate to reach out!</p>
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

const sendPodcastPublishedEmail = (email, podcastLink, title) => {


  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `New Feedback on Your Podcast: ${title}`,
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
                background-color: #e7f4e7;
                padding: 10px;
                border-left: 5px solid #28a745;
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
                <h1>Podcast Published: ${title}</h1>
            </div>
            <div class="content">
                <p>Dear Author,</p>
                <p>We are excited to inform you that your podcast titled "<strong>{title}</strong>" has been successfully published on UltimateHealth!</p>

                <p>Your work is now live for our listeners to enjoy, and we are thrilled to share your insights with the community. We sincerely appreciate the effort you’ve put into this content and hope it resonates with many!</p>

                <div class="note">
                    <p><strong>Note:</strong> You can view your podcast by following this <a href="${podcastLink}" class="btn">link</a>.</p>
                </div>

                <p>Thank you for contributing to UltimateHealth. If you have any questions or need further assistance, don’t hesitate to reach out!</p>
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

const sendPodcastDiscardEmail = (email, status, title, reason) => {


  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Podcast Discarded ${title}`,
    html: status !== statusEnum.statusEnum.REVIEW_PENDING ? `<html>
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
              background-color: #dc3545;
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
              <h1>Podcast Discarded: ${title}</h1>
          </div>
          <div class="content">
              <p>Dear Author,</p>
              <p>We regret to inform you that your podcast titled "<strong>{title}</strong>" has been discarded from our review process.</p>

              <p><strong>Reason for Discard:</strong> ${reason} </p>

              <p>Our review system automatically discards submissions that do not meet the necessary criteria or deadlines.</p>

              <p>If you would like to address the issue and resubmit your podcast, or if you have any questions regarding this decision, please don’t hesitate to contact us. We would be happy to review your work again.</p>

              <div class="note">
                  <p><strong>Note:</strong> You can submit new podcasts for review at any time.</p>
              </div>

              <p>We appreciate your effort and wish you success in your creative journey.</p>
          </div>
          <div class="footer">
              <p>Best regards,<br>UltimateHealth Team</p>
          </div>
      </div>
  </body>
</html>
` :
      `<html>
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
              background-color: #dc3545;
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
              <h1>Podcast Discarded: "${title}"</h1>
          </div>
          <div class="content">
              <p>Dear Author,</p>
              <p>We regret to inform you that your podcast titled "<strong>${title}</strong>" has been discarded from our review process due to the lack of action taken within the required review period of 30 days.</p>

              <p>Our review system automatically discards contents that do not receive feedback or revisions within the set time frame. Unfortunately, we did not receive any updates or revisions within the 30-day deadline.</p>

              <p>If you would like to resubmit your podcast or have any questions, feel free to contact us for further assistance. We would be happy to consider your work again in the future.</p>

              <div class="note">
                  <p><strong>Note:</strong> You can submit new podcasts for review at any time.</p>
              </div>

              <p>We wish you the best in your future!</p>
          </div>
          <div class="footer">
              <p>Best regards,<br>UltimateHealth Team</p>
          </div>
      </div>
  </body>
</html>
`,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending email:', err);
    } else {
      console.log('Verification email sent:', info.response);
    }
  });
};
const sendArticleDiscardEmail = (email, status, title, reason) => {


  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Article Discarded ${title}`,
    html: status === statusEnum.statusEnum.UNASSIGNED ? `<html>
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
              background-color: #dc3545;
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
              <h1>Article Discarded: "${title}"</h1>
          </div>
          <div class="content">
              <p>Dear Author,</p>
              <p>We regret to inform you that your article titled "<strong>${title}</strong>" has been discarded from our review process due to the lack of action taken within the required review period of 30 days.</p>

              <p>Our review system automatically discards articles that do not receive feedback or revisions within the set time frame. Unfortunately, we did not receive any updates or revisions within the 30-day deadline.</p>

              <p>If you would like to resubmit your article or have any questions, feel free to contact us for further assistance. We would be happy to consider your work again in the future.</p>

              <div class="note">
                  <p><strong>Note:</strong> You can submit new articles for review at any time.</p>
              </div>

              <p>We wish you the best in your future writing endeavors!</p>
          </div>
          <div class="footer">
              <p>Best regards,<br>UltimateHealth Team</p>
          </div>
      </div>
  </body>
</html>
` :
      `<html>
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
              background-color: #dc3545;
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
              <h1>Article Discarded: "${title}"</h1>
          </div>
          <div class="content">
              <p>Dear Author,</p>
              <p>We regret to inform you that your article titled "<strong>${title}</strong>" has been discarded from our review process.</p>

              <p><strong>Reason for Discard:</strong> ${reason} </p>

              <p>Our review system automatically discards submissions that do not meet the necessary criteria or deadlines.</p>

              <p>If you would like to address the issue and resubmit your article, or if you have any questions regarding this decision, please don’t hesitate to contact us. We would be happy to review your work again.</p>

              <div class="note">
                  <p><strong>Note:</strong> You can submit new article for review at any time.</p>
              </div>

              <p>We appreciate your effort and wish you success in your creative journey.</p>
          </div>
          <div class="footer">
              <p>Best regards,<br>UltimateHealth Team</p>
          </div>
      </div>
  </body>
</html>
`,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending email:', err);
    } else {
      console.log('Verification email sent:', info.response);
    }
  });
};

const sendMailArticleDiscardByAdmin = (email, title, discardReason) => {

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Article Discarded ${title}`,
    html: `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Account Discarded</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f9f9f9;
                        color: #333;
                        padding: 20px;
                    }
                    .container {
                        background-color: white;
                        border-radius: 8px;
                        box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
                        padding: 30px;
                        text-align: center;
                        max-width: 600px;
                        margin: 0 auto;
                    }
                    h1 {
                        color: #FF6347;
                    }
                    p {
                        font-size: 16px;
                        color: #555;
                    }
                    .reason {
                        font-size: 18px;
                        font-weight: bold;
                        color: #FF6347;
                        margin-top: 20px;
                    }
                    .footer {
                        font-size: 12px;
                        color: #888;
                        margin-top: 30px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Article Discarded</h1>
                    <p>Dear Author,</p>
                    <p>We regret to inform you that your account request has been discarded due to the following reason:</p>
                    <div class="reason">${discardReason}</div>
                    <p>If you believe this is a mistake, please contact our support team.</p>
                    <div class="footer">
                        <p>Best regards,</p>
                        <p>UltimateHealth Team</p>
                    </div>
                </div>
            </body>
            </html>
            `
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending email:', err);
    } else {
      console.log('Verification email sent:', info.response);
    }
  });

}

// send email on approval of edit request
const sendMailOnEditRequestApproval = (email, title) => {

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Edit Request Accepted on article: ${title}`,
    html: `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Improvement Request Approved</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f9f9f9;
                    color: #333;
                    padding: 20px;
                }
                .container {
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
                    padding: 30px;
                    text-align: center;
                    max-width: 600px;
                    margin: 0 auto;
                }
                h1 {
                    color: #4CAF50;
                }
                p {
                    font-size: 16px;
                    color: #555;
                }
                .highlight {
                    font-weight: bold;
                    color: #4CAF50;
                }
                .footer {
                    font-size: 12px;
                    color: #888;
                    margin-top: 30px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Improvement Request Approved</h1>
                <p>Dear Author,</p>
                <p>Your edit request for the article titled <span class="highlight">"${title}"</span> has been accepted.</p>
                <p>Please make the necessary improvements within <span class="highlight">4 days</span> from the date of this email.</p>
                <p>If you have any questions or need clarification on the required changes, feel free to reach out.</p>
                <div class="footer">
                    <p>Best regards,</p>
                    <p>UltimateHealth Team</p>
                </div>
            </div>
        </body>
        </html>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending email:', err);
    } else {
      console.log('Verification email sent:', info.response);
    }
  });
}

/** Report related mail */
const sendReportUndertakenEmail = (email, issueNumber) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Your Report is Being Reviewed (Issue No. ${issueNumber})`,
    html: `
         <div style="font-family: Arial, sans-serif;">
         <h2>Your Report is Being Reviewed</h2>
         <p>Hello,</p>
         <p>Your report with Issue No. <strong>${issueNumber}</strong> has been picked up by a moderator for review.</p>
         <p>We will update you once the review is complete.</p>
         <p>Thank you for helping us maintain the quality of our platform.</p>
        </div>
        `,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending report undertaken email:', err);
    } else {
      console.log('Report undertaken email sent:', info.response);
    }
  });
};

// Send Mail (Optional)
const sendInitialReportMailtoVictim = async (email) => {

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Thank You for Reporting - Your Concern is Being Addressed',
    html: `
  <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            width: 100%;
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          .header {
            background-color: #00BFFF;
            color: #fff;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            padding: 20px;
          }
          .footer {
            text-align: center;
            padding: 10px;
            font-size: 14px;
            background-color: #f1f1f1;
            border-radius: 0 0 8px 8px;
          }
          a {
            color: #00BFFF;
            text-decoration: none;
          }
          .btn {
            background-color: #00BFFF;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            text-decoration: none;
            font-weight: bold;
            display: inline-block;
            margin-top: 20px;
          }
          .btn:hover {
            background-color: #00BFFF;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Thank You for Reporting</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We want to thank you for submitting your report regarding inappropriate content. Your action helps us keep the community safe and ensure that our platform remains a space where everyone can feel respected and secure.</p>
            
            <p>Your identity will be kept confidential, and we assure you that your report will be handled with the utmost care and urgency. Our team is currently reviewing the situation and will take appropriate actions based on our guidelines.</p>

            <p>We take reports like yours very seriously and are committed to making sure that our platform remains a safe environment for all users. If you have any additional information or if you would like to follow up, please don’t hesitate to reach out to us.</p>

            <p>If you believe you did not submit this report or if you have any questions, you can contact us directly at <a href="mailto:ultimate.health25@gmail.com">ultimate.health25@gmail.com</a>.</p>

            <a href="mailto:ultimate.health25@gmail.com" class="btn">Contact Support</a>
          </div>
          <div class="footer">
            <p>Best regards,<br>The UltimateHealth Team</p>
            <p>© 2025 UltimateHealth. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending email:', err);
    } else {
      console.log('Report email sent:', info.response);
    }
  });
}

// Send mail to the user against whom the report is submitted

const sendInitialReportMailtoConvict = async (email, details, reportType) => {

  const reportDetails = reportType === 'content' ?
    `<div style="padding: 15px; border: 2px solid #FF6347; background-color: #FFFAF0; border-radius: 8px;">
       <h3 style="color: #FF6347;">Reported Content:</h3>
       <p><strong>Content ID:</strong> ${details.articleId ? details.articleId : details.podcastId}</p>
       <p><strong>Description:</strong> ${details.title}</p>
     </div>` :
    `<div style="padding: 15px; border: 2px solid #4682B4; background-color: #F0F8FF; border-radius: 8px;">
       <h3 style="color: #4682B4;">Reported Comment:</h3>
       <p><strong>Comment ID:</strong> ${details.commentId}</p>
       <p><strong>Comment:</strong> ${details.comment}</p>
     </div>`
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Important: A Report Has Been Submitted Regarding Your ${reportType}`,
    html: `
  <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f6f9;
              color: #333;
              margin: 0;
              padding: 0;
            }
            .container {
              width: 100%;
              max-width: 600px;
              margin: 30px auto;
              background-color: #ffffff;
              border-radius: 8px;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
              padding: 20px;
            }
            .header {
              background-color: #FF6347; /* Red color for report seriousness */
              color: #fff;
              padding: 15px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              padding: 20px;
            }
            .footer {
              text-align: center;
              padding: 10px;
              font-size: 14px;
              background-color: #f1f1f1;
              border-radius: 0 0 8px 8px;
            }
            a {
              color: #FF6347;
              text-decoration: none;
            }
            .btn {
              background-color: #FF6347;
              color: white;
              padding: 10px 20px;
              border-radius: 5px;
              text-decoration: none;
              font-weight: bold;
              display: inline-block;
              margin-top: 20px;
            }
            .btn:hover {
              background-color: #FF4500;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Important: Report Submitted Regarding Your ${reportType}</h2>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We want to inform you that a report has been submitted regarding your ${reportType} on our platform.</p>
              
              <p>Here are the details of the reported ${reportType}:</p>
              ${reportDetails}

              <p>Our team is reviewing the matter and will take appropriate action based on our community guidelines. We ask that you continue to follow the guidelines to maintain a respectful and safe environment for all users.</p>

              <p>If you believe the report is incorrect or if you wish to provide more context, please feel free to contact our support team at <a href="mailto:ultimate.health25@gmail.com">ultimate.health25@gmail.com</a>.</p>

              <a href="mailto:ultimate.health25@gmail.com" class="btn">Contact Support</a>
            </div>
            <div class="footer">
              <p>Best regards,<br>The UltimateHealth Team</p>
              <p>© 2025 UltimateHealth. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending email:', err);
    } else {
      console.log('Report email sent:', info.response);
    }
  });
}

const sendResolvedMailToVictim = async (email, details, reportType, resolution) => {
  const resolvedDetails = reportType === 'content' ?
    `<div style="padding: 15px; border: 2px solid #32CD32; background-color: #F0FFF0; border-radius: 8px;">
       <h3 style="color: #32CD32;">Reported Content (Resolved):</h3>
       <p><strong>Content ID:</strong> ${details.articleId ? details.articleId : details.podcastId}</p>
       <p><strong>Description:</strong> ${details.content}</p>
     </div>` :
    `<div style="padding: 15px; border: 2px solid #32CD32; background-color: #F0FFF0; border-radius: 8px;">
       <h3 style="color: #32CD32;">Reported Comment (Resolved):</h3>
       <p><strong>Comment ID:</strong> ${details.commentId}</p>
       <p><strong>Comment:</strong> ${details.content}</p>
     </div>`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Update: Your Reported ${reportType} Has Been Reviewed`,
    html: `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          .header {
            background-color: #32CD32;
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            padding: 20px;
          }
          .footer {
            background-color: #f1f1f1;
            text-align: center;
            padding: 10px;
            border-radius: 0 0 8px 8px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Report Reviewed and Resolved</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Thank you for reporting the following ${reportType}. Our moderation team has reviewed your report and resolved the issue.</p>
            ${resolvedDetails}
            <p><strong>Resolution: </strong> ${resolution}</p>
            <p>We appreciate your effort in helping us keep the community safe and respectful.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The UltimateHealth Team</p>
            <p>© 2025 UltimateHealth. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending email to victim:', err);
    } else {
      console.log('Resolved report email sent to victim:', info.response);
    }
  });
};

const sendResolvedMailToConvict = async (email, details, reportType) => {
  const resolvedDetails = reportType === 'content' ?
    `<div style="padding: 15px; border: 2px solid #FFA500; background-color: #FFF8DC; border-radius: 8px;">
       <h3 style="color: #FFA500;">Your Content Was Reported:</h3>
       <p><strong>Content ID:</strong> ${details.articleId ? details.articleId : details.podcastId}</p>
       <p><strong>Description:</strong> ${details.content}</p>
     </div>` :
    `<div style="padding: 15px; border: 2px solid #FFA500; background-color: #FFF8DC; border-radius: 8px;">
       <h3 style="color: #FFA500;">Your Comment Was Reported:</h3>
       <p><strong>Comment ID:</strong> ${details.commentId}</p>
       <p><strong>Comment:</strong> ${details.content}</p>
     </div>`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Notice: Review of Reported ${reportType}`,
    html: `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          .header {
            background-color: #FFA500;
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            padding: 20px;
          }
          .footer {
            background-color: #f1f1f1;
            text-align: center;
            padding: 10px;
            border-radius: 0 0 8px 8px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Reported ${reportType} Reviewed</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>This is to inform you that a report was reviewed concerning the following ${reportType} associated with your account.</p>
            ${resolvedDetails}
            <p><strong>Outcome:</strong> Resolved </p>
            <p>Please ensure your future activity aligns with our <a href="#">community guidelines</a> to maintain a respectful and safe environment for everyone.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The UltimateHealth Team</p>
            <p>© 2025 UltimateHealth. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending email to convict:', err);
    } else {
      console.log('Resolved report email sent to convict:', info.response);
    }
  });
};

// Misuse of report feature
const sendWarningMailToVictimOnReportDismissOrIgnore = async (email, details, reportType, reason, misuseCount) => {
  const reportSummary = reportType === 'content' ?
    `<div style="padding: 15px; border: 2px solid #FFD700; background-color: #FFFACD; border-radius: 8px;">
       <h3 style="color: #DAA520;">Reported Content:</h3>
       <p><strong>Content ID:</strong> ${details.articleId ? details.articleId : details.podcastId}</p>
       <p><strong>Description:</strong> ${details.content}</p>
     </div>` :
    `<div style="padding: 15px; border: 2px solid #FFD700; background-color: #FFFACD; border-radius: 8px;">
       <h3 style="color: #DAA520;">Reported Comment:</h3>
       <p><strong>Comment ID:</strong> ${details.commentId}</p>
       <p><strong>Comment:</strong> ${details.content}</p>
     </div>`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `⚠️Warning: Inappropriate Use of Report Feature (${misuseCount}/3)`,
    html: `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          .header {
            background-color: #FFD700;
            color: black;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
          }
          .content {
            padding: 20px;
          }
          .footer {
            background-color: #f1f1f1;
            text-align: center;
            padding: 10px;
            border-radius: 0 0 8px 8px;
            font-size: 14px;
          }
          .reason {
            background-color: #fff8e1;
            padding: 10px;
            border-left: 4px solid #FFD700;
            margin: 15px 0;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ⚠️ Warning: Misuse of Reporting Tool
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We reviewed your recent report concerning the following ${reportType}, and we found it to be inappropriate or made in bad faith:</p>
            ${reportSummary}
            <div class="reason"><strong>Reason:</strong> ${reason}</div>
            <p>Our reporting tool is meant to address real violations of our community guidelines. Misusing this tool can harm the experience for others and may result in restrictions on your account.</p>
            <p>Please ensure that future reports are valid and made with sincere intent to improve the platform for all users.</p>
            
            <div class="warning">
              This is warning ${misuseCount} of 3. After 3 confirmed misuses, your account may be blocked or suspended for 1 month.
            </div>

            <p>If you believe this warning was issued in error, feel free to contact our support team.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The UltimateHealth Team</p>
            <p>© 2025 UltimateHealth. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending warning email to victim:', err);
    } else {
      console.log('Warning email sent to victim:', info.response);
    }
  });
};

const sendDismissedOrIgnoreMailToConvict = async (email, details, reportType) => {
  const dismissedDetails = reportType === 'content' ?
    `<div style="padding: 15px; border: 2px solid #90EE90; background-color: #F0FFF0; border-radius: 8px;">
       <h3 style="color: #228B22;">Content Report Dismissed:</h3>
       <p><strong>Content ID:</strong> ${details.articleId ? details.articleId : details.podcastId}</p>
       <p><strong>Description:</strong> ${details.content}</p>
     </div>` :
    `<div style="padding: 15px; border: 2px solid #90EE90; background-color: #F0FFF0; border-radius: 8px;">
       <h3 style="color: #228B22;">Comment Report Dismissed:</h3>
       <p><strong>Comment ID:</strong> ${details.commentId}</p>
       <p><strong>Comment:</strong> ${details.content}</p>
     </div>`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Notice: Report on Your ${reportType} Has Been Dismissed`,
    html: `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          .header {
            background-color: #90EE90;
            color: black;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
          }
          .content {
            padding: 20px;
          }
          .footer {
            background-color: #f1f1f1;
            text-align: center;
            padding: 10px;
            border-radius: 0 0 8px 8px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ✅ Report Dismissed – No Action Taken
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>This is to inform you that a report was submitted regarding the following ${reportType}:</p>
            ${dismissedDetails}
            <p>After careful review, our moderation team has determined that your ${reportType} does not violate our community guidelines. As a result, no action has been taken against your account.</p>
            <p>If you have any questions or concerns, feel free to reach out to our support team.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The UltimateHealth Team</p>
            <p>© 2025 UltimateHealth. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending dismissal email to convict:', err);
    } else {
      console.log('Dismissal email sent to convict:', info.response);
    }
  });
};

const sendWarningMailToConvict = async (email, details, reportType, reason, strikeCount = 1) => {
  const warningDetails = reportType === 'content' ?
    `<div style="padding: 15px; border: 2px solid #FF6347; background-color: #FFF5F5; border-radius: 8px;">
       <h3 style="color: #FF6347;">Violated Content:</h3>
       <p><strong>Content ID:</strong> ${details.articleId ? details.articleId : details.podcastId}</p>
       <p><strong>Description:</strong> ${details.content}</p>
     </div>` :
    `<div style="padding: 15px; border: 2px solid #FF6347; background-color: #FFF5F5; border-radius: 8px;">
       <h3 style="color: #FF6347;">Violated Comment:</h3>
       <p><strong>Comment ID:</strong> ${details.commentId}</p>
       <p><strong>Comment:</strong> ${details.content}</p>
     </div>`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `⚠️ Warning: Violation of Community Guidelines (${strikeCount}/3)`,
    html: `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          .header {
            background-color: #FF6347;
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
          }
          .content {
            padding: 20px;
          }
          .reason {
            background-color: #ffeaea;
            padding: 10px;
            border-left: 4px solid #FF6347;
            margin: 15px 0;
            font-style: italic;
          }
          .strike-warning {
            background-color: #ffebee;
            color: #b71c1c;
            padding: 15px;
            border-radius: 6px;
            font-weight: bold;
            border-left: 5px solid #f44336;
            margin-top: 20px;
          }
          .footer {
            background-color: #f1f1f1;
            text-align: center;
            padding: 10px;
            border-radius: 0 0 8px 8px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ⚠️ Warning Issued
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Your ${reportType} was reviewed and found to be in violation of our community guidelines.</p>
            ${warningDetails}
            <div class="reason"><strong>Reason:</strong> ${reason}</div>

            <div class="strike-warning">
              This is warning ${strikeCount} of 3. Repeated violations may lead to permanent suspension of your account.
            </div>

            <p>Please review our <a href="#">community guidelines</a> to avoid further issues. Continued engagement must follow platform rules to ensure a respectful and safe space for everyone.</p>

            <p>If you believe this warning was issued incorrectly, contact us at <a href="mailto:ultimate.health25@gmail.com">ultimate.health25@gmail.com</a>.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The UltimateHealth Team</p>
            <p>© 2025 UltimateHealth. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending warning email to convict:', err);
    } else {
      console.log('Warning email sent to convict:', info.response);
    }
  });
};

const sendRemoveContentMailToConvict = async (email, details, reportType, reason) => {
  const warningDetails = reportType === 'content' ?
    `<div style="padding: 15px; border: 2px solid #FF6347; background-color: #FFF5F5; border-radius: 8px;">
       <h3 style="color: #FF6347;">Violated Content:</h3>
       <p><strong>Content ID:</strong> ${details.articleId ? details.articleId : details.podcastId}</p>
       <p><strong>Description:</strong> ${details.content}</p>
     </div>` :
    `<div style="padding: 15px; border: 2px solid #FF6347; background-color: #FFF5F5; border-radius: 8px;">
       <h3 style="color: #FF6347;">Violated Comment:</h3>
       <p><strong>Comment ID:</strong> ${details.commentId}</p>
       <p><strong>Comment:</strong> ${details.content}</p>
     </div>`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `⚠️ Warning: Content Removed, Violation of Community Guidelines`,
    html: `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          .header {
            background-color: #FF6347;
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
          }
          .content {
            padding: 20px;
          }
          .reason {
            background-color: #ffeaea;
            padding: 10px;
            border-left: 4px solid #FF6347;
            margin: 15px 0;
            font-style: italic;
          }
          .strike-warning {
            background-color: #ffebee;
            color: #b71c1c;
            padding: 15px;
            border-radius: 6px;
            font-weight: bold;
            border-left: 5px solid #f44336;
            margin-top: 20px;
          }
          .footer {
            background-color: #f1f1f1;
            text-align: center;
            padding: 10px;
            border-radius: 0 0 8px 8px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ⚠️ Warning Issued
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Your ${reportType} was reviewed and found to be in violation of our community guidelines.</p>
            ${warningDetails}
            <div class="reason"><strong>Reason:</strong> ${reason}</div>

            <div class="strike-warning">
              This is a warning, not a strike. We are only removing your content, Repeated violations may lead to permanent suspension of your account.
            </div>

            <p>Please review our <a href="#">community guidelines</a> to avoid further issues. Continued engagement must follow platform rules to ensure a respectful and safe space for everyone.</p>

            <p>If you believe this warning was issued incorrectly, contact us at <a href="mailto:ultimate.health25@gmail.com">ultimate.health25@gmail.com</a>.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The UltimateHealth Team</p>
            <p>© 2025 UltimateHealth. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending warning email to convict:', err);
    } else {
      console.log('Warning email sent to convict:', info.response);
    }
  });
};

const sendRestoreContentMailToUser = async (email, articleTitle) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `✅ Your Content Has Been Restored`,
    html: `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          .header {
            background-color: #4CAF50;
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
          }
          .content {
            padding: 20px;
          }
          .restored-content {
            background-color: #e8f5e9;
            padding: 15px;
            border-left: 4px solid #4CAF50;
            border-radius: 6px;
            margin-top: 20px;
          }
          .footer {
            background-color: #f1f1f1;
            text-align: center;
            padding: 10px;
            border-radius: 0 0 8px 8px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ✅ Content Restoration Notice
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We’re writing to inform you that the following content previously removed from your account has been reviewed and successfully restored:</p>

            <div class="restored-content">
           
              <p><strong>Article Title:</strong> ${articleTitle}</p>
            </div>

            <p>This restoration was processed in response to a valid request and after re-evaluation under our community guidelines.</p>

            <p>If you have any questions or concerns, feel free to reach out to us at <a href="mailto:ultimate.health25@gmail.com">ultimate.health25@gmail.com</a>.</p>

            <p>Thank you for being part of the UltimateHealth community.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The UltimateHealth Team</p>
            <p>© 2025 UltimateHealth. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending restore content email:', err);
    } else {
      console.log('Restore content email sent:', info.response);
    }
  });
};

const sendRestoreRequestReceivedMail = async (email, articleTitle) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `📥 We've Received Your Content Restoration Request`,
    html: `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          .header {
            background-color: #1976D2;
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
          }
          .content {
            padding: 20px;
          }
          .request-info {
            background-color: #e3f2fd;
            padding: 15px;
            border-left: 4px solid #1976D2;
            border-radius: 6px;
            margin-top: 20px;
          }
          .footer {
            background-color: #f1f1f1;
            text-align: center;
            padding: 10px;
            border-radius: 0 0 8px 8px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            📥 Request Confirmation
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We’ve received your request to restore the following content:</p>

            <div class="request-info">
              <p><strong>Article Title:</strong> ${articleTitle}</p>
            </div>

            <p>Our team will review your request carefully to ensure it meets our content and community guidelines.</p>

            <p>You’ll receive a follow-up email once the review is complete. This process may take up to 3–5 business days.</p>

            <p>If you have any additional information to support your request, feel free to reply to this email at <a href="mailto:ultimate.health25@gmail.com">ultimate.health25@gmail.com</a>.</p>

            <p>Thanks for your patience and for being part of the UltimateHealth community.</p>
          </div>
          <div class="footer">
            <p>Warm regards,<br>The UltimateHealth Team</p>
            <p>© 2025 UltimateHealth. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending restore request received email:', err);
    } else {
      console.log('Restore request received email sent:', info.response);
    }
  });
};

const sendRestoreRequestDisapprovedMail = async (email, articleTitle) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `❌ Content Restoration Request Denied`,
    html: `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          .header {
            background-color: #d32f2f;
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
          }
          .content {
            padding: 20px;
          }
          .disapproval-info {
            background-color: #ffebee;
            padding: 15px;
            border-left: 4px solid #d32f2f;
            border-radius: 6px;
            margin-top: 20px;
          }
          .footer {
            background-color: #f1f1f1;
            text-align: center;
            padding: 10px;
            border-radius: 0 0 8px 8px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ❌ Request Denied
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Thank you for submitting a content restoration request. After a thorough review, we regret to inform you that your request to restore the following content has been denied:</p>

            <div class="disapproval-info">
              <p><strong>Article Title:</strong> ${articleTitle}</p>
            </div>

            <p>Unfortunately, the content did not meet our community guidelines or failed to comply with our platform's terms of use. As a result, we are unable to proceed with the restoration.</p>

            <p>If you believe this decision was made in error or you have new information to provide, feel free to respond to this email at <a href="mailto:ultimate.health25@gmail.com">ultimate.health25@gmail.com</a>.</p>

            <p>We appreciate your understanding and continued support of the UltimateHealth community.</p>
          </div>
          <div class="footer">
            <p>Kind regards,<br>The UltimateHealth Team</p>
            <p>© 2025 UltimateHealth. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending disapproval email:', err);
    } else {
      console.log('Disapproval email sent:', info.response);
    }
  });
};


const sendBlockConvictMail = async (email, details, reportType, reason) => {
  const reportedItem = reportType === 'content'
    ? `<div style="padding: 15px; border: 2px solid #DC143C; background-color: #FFF5F5; border-radius: 8px;">
         <h3 style="color: #DC143C;">Violated Content:</h3>
         <p><strong>Content ID:</strong> ${details.articleId ? details.articleId : details.podcastId}</p>
         <p><strong>Description:</strong> ${details.content}</p>
       </div>`
    : `<div style="padding: 15px; border: 2px solid #DC143C; background-color: #FFF5F5; border-radius: 8px;">
         <h3 style="color: #DC143C;">Violated Comment:</h3>
         <p><strong>Comment ID:</strong> ${details.commentId}</p>
         <p><strong>Comment:</strong> ${details.content}</p>
       </div>`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `🚫 Account Temporarily Blocked Due to Policy Violation`,
    html: `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          .header {
            background-color: #DC143C;
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
          }
          .content {
            padding: 20px;
          }
          .reason {
            background-color: #ffeaea;
            padding: 10px;
            border-left: 4px solid #DC143C;
            margin: 15px 0;
            font-style: italic;
          }
          .block-notice {
            background-color: #ffebee;
            color: #b71c1c;
            padding: 15px;
            border-radius: 6px;
            font-weight: bold;
            border-left: 5px solid #f44336;
            margin-top: 20px;
          }
          .restrictions {
            background-color: #fff8dc;
            padding: 15px;
            margin: 20px 0;
            border-left: 5px solid #ffa500;
            border-radius: 6px;
          }
          ul {
            margin: 10px 0 10px 20px;
            padding: 0;
          }
          .footer {
            background-color: #f1f1f1;
            text-align: center;
            padding: 10px;
            border-radius: 0 0 8px 8px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            🚫 Your Account Has Been Temporarily Blocked
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We have reviewed a report concerning the following ${reportType} associated with your account:</p>
            ${reportedItem}
            <div class="reason"><strong>Reason:</strong> ${reason}</div>

            <div class="block-notice">
              Your account has been temporarily blocked for 1 month due to violations of our community guidelines.
            </div>

            <div class="restrictions">
              <h4 style="margin: 0 0 10px 0;">📌 Blocked User Restrictions:</h4>
              <ul>
                <li>You will be unable to post new content.</li>
                <li>You will be unable to comment on existing content.</li>
                <li>You will be unable to react to or repost any content.</li>
                <li>You will be unable to submit edit requests.</li>
                <li><strong>You can still view and save existing content.</strong></li>
              </ul>
            </div>

            <p>Please take this time to review our <a href="#">community guidelines</a>. Respectful and responsible behavior is required to maintain access to the platform.</p>

            <p>If you believe this block was issued in error, you may contact our support team at <a href="mailto:ultimate.health25@gmail.com">ultimate.health25@gmail.com</a> to appeal.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The UltimateHealth Team</p>
            <p>© 2025 UltimateHealth. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending block email to convict:', err);
    } else {
      console.log('Block email sent to convict:', info.response);
    }
  });
};

const sendBannedUserMail = async (email, details, reportType, reason) => {
  const reportedItem = reportType === 'content'
    ? `<div style="padding: 15px; border: 2px solid #8B0000; background-color: #FFF0F0; border-radius: 8px;">
         <h3 style="color: #8B0000;">Violated Content:</h3>
         <p><strong>Content ID:</strong> ${details.articleId ? details.articleId : details.podcastId}</p>
         <p><strong>Description:</strong> ${details.content}</p>
       </div>`
    : `<div style="padding: 15px; border: 2px solid #8B0000; background-color: #FFF0F0; border-radius: 8px;">
         <h3 style="color: #8B0000;">Violated Comment:</h3>
         <p><strong>Comment ID:</strong> ${details.commentId}</p>
         <p><strong>Comment:</strong> ${details.content}</p>
       </div>`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `❌ Account Permanently Banned Due to Severe Policy Violation`,
    html: `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f8f9fc;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          .header {
            background-color: #8B0000;
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
          }
          .content {
            padding: 20px;
          }
          .reason {
            background-color: #ffe6e6;
            padding: 10px;
            border-left: 4px solid #8B0000;
            margin: 15px 0;
            font-style: italic;
          }
          .ban-notice {
            background-color: #fff0f0;
            color: #8B0000;
            padding: 15px;
            border-radius: 6px;
            font-weight: bold;
            border-left: 5px solid #b22222;
            margin-top: 20px;
          }
          .footer {
            background-color: #f1f1f1;
            text-align: center;
            padding: 10px;
            border-radius: 0 0 8px 8px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ❌ Permanent Account Ban Notification
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Following a thorough review, we have determined that your account violated our community guidelines in the following ${reportType}:</p>
            ${reportedItem}
            <div class="reason"><strong>Reason:</strong> ${reason}</div>

            <div class="ban-notice">
              Your account has been <strong>permanently banned</strong> from the UltimateHealth platform. This action is final and cannot be undone.
            </div>

            <p>Due to the severity of this violation, you are no longer permitted to access or create any new content or interactions on our platform.</p>

            <p>For more details, please review our <a href="#">community guidelines</a>.</p>

            <p>If you believe this action was taken in error, you may contact our support team at <a href="mailto:ultimate.health25@gmail.com">ultimate.health25@gmail.com</a> with any questions or concerns.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The UltimateHealth Team</p>
            <p>© 2025 UltimateHealth. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending ban email to user:', err);
    } else {
      console.log('Ban email sent to user:', info.response);
    }
  });
};

const sendUnblockUserMail = async (email, username) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `✅ Account Access Restored`,
    html: `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f9;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            padding: 20px;
          }
          .header {
            background-color: #4CAF50;
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
          }
          .content {
            padding: 20px;
          }
          .unblock-notice {
            background-color: #e8f5e9;
            color: #2e7d32;
            padding: 15px;
            border-radius: 6px;
            font-weight: bold;
            border-left: 5px solid #4CAF50;
            margin-top: 20px;
          }
          .reminder {
            background-color: #fff8dc;
            padding: 15px;
            margin: 20px 0;
            border-left: 5px solid #ffa500;
            border-radius: 6px;
          }
          .footer {
            background-color: #f1f1f1;
            text-align: center;
            padding: 10px;
            border-radius: 0 0 8px 8px;
            font-size: 14px;
          }
          a {
            color: #4CAF50;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ✅ Your Account Has Been Unblocked
          </div>
          <div class="content">
            <p>Hello${username ? ` ${username}` : ''},</p>

            <p>We’re pleased to inform you that the temporary block on your account has now been lifted. You have regained full access to your account features.</p>

            <div class="unblock-notice">
              Your account access has been fully restored.
            </div>

            <div class="reminder">
              <h4 style="margin: 0 0 10px 0;">📌 Please Remember:</h4>
              <p>Continued access to our platform is contingent on adhering to our <a href="#">community guidelines</a>. Repeated violations may result in more severe penalties, including permanent suspension.</p>
            </div>

            <p>If you have any questions or concerns, feel free to contact our support team at <a href="mailto:ultimate.health25@gmail.com">ultimate.health25@gmail.com</a>.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The UltimateHealth Team</p>
            <p>© 2025 UltimateHealth. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Error sending unblock email:', err);
    } else {
      console.log('Unblock email sent successfully:', info.response);
    }
  });
};



module.exports = {
  sendVerificationEmail,
  verifyEmail,
  Sendverifymail,
  resendVerificationEmail,
  sendArticleFeedbackEmail,
  sendArticlePublishedEmail,
  sendArticleDiscardEmail,
  sendMailArticleDiscardByAdmin,
  sendMailOnEditRequestApproval,
  sendReportUndertakenEmail,
  sendInitialReportMailtoConvict,
  sendInitialReportMailtoVictim,
  sendResolvedMailToVictim,
  sendResolvedMailToConvict,
  sendWarningMailToVictimOnReportDismissOrIgnore,
  sendDismissedOrIgnoreMailToConvict,
  sendWarningMailToConvict,
  sendRemoveContentMailToConvict,
  sendBlockConvictMail,
  sendBannedUserMail,
  sendRestoreContentMailToUser,
  sendUnblockUserMail,
  sendRestoreRequestReceivedMail,
  sendRestoreRequestDisapprovedMail,
  sendPodcastPublishedEmail,
  sendPodcastDiscardEmail
};



