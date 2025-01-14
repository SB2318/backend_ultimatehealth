const nodemailer = require('nodemailer');
require('dotenv').config();
const expressAsyncHandler = require("express-async-handler");
const Report = require("../models/reportModel");
const Reason = require("../models/reportModel");
const Article = require('../models/Articles');
const User = require("../models/UserModel");

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Add Reason
module.exports.addReason = expressAsyncHandler(

    async (req, res) => {
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ message: "Please add a reason." });
        }

        try {
            await Reason.create({ reason });
            res.status(201).json({ message: "Reason added successfully." });
        } catch (err) {
            return res.status(500).json({ message: "Failed to add reason, Internal server error" });
        }
    }
)
// Update Reason
module.exports.updateReason = expressAsyncHandler(
    async (req, res) => {

        const { id, reason } = req.body;

        if (!id || !reason) {
            return res.status(400).json({ message: "Please add a id and reason." });
        }

        try {
            const reason = await Reason.findById(id);
            if (!reason) {
                return res.status(404).json({ message: "Reason not found." });
            }
            reason.reason = reason;
            await reason.save();
            res.status(200).json({ message: "Reason updated successfully." });
        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: "Failed to update reason, Internal server error" });
        }
    }
)
// Delete Reason
module.exports.deleteReason = expressAsyncHandler(
    async (req, res) => {

        const id = req.params.id;

        if (!id) {
            return res.status(400).json({ message: "id not found" });
        }

        try {
            const reason = await Reason.findById(Number(id));
            if (!reason) {
                return res.status(404).json({ message: "Reason not found." });
            }
            await reason.remove();
            res.status(200).json({ message: "Reason deleted successfully." });
        }
        catch (err) {
            console.log(err);
            return res.status(500).json({ message: "Failed to delete reason, Internal server error" });
        }
    }
)
// Get all Reasons
module.exports.getAllReasons = expressAsyncHandler(

    async (req, res) => {

        try {
            const reasons = await Reason.find().sort({ createdAt: -1 });
            res.status(200).json(reasons);
        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
)
// Submit Report
module.exports.submitReport = expressAsyncHandler(
    async (req, res) => {

        const { articleId, commentId, reportedBy, reasonId } = req.body;

        if (!articleId || !reportedBy || !reasonId) {
            return res.status(400).json({ message: "Please fill in all fields." });
        }

        try {

            const [article, user, reason] = await Promise.all(
                [
                    Article.findById(Number(articleId)),
                    User.findById(reportedBy),
                    Reason.findById(Number(reasonId)),
                ]
            );

            if(commentId){
                const comment = await Comment.findById(commentId);

                if(!comment){
                    return res.status(404).json({ message: "Comment not found." });
                }
            }

            if (!article) {
                return res.status(404).json({ message: "Article not found." });
            }
            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }
            if (!reason) {
                return res.status(404).json({ message: "Please select a valid reason" });
            }

            const report = new Report({
                articleId: Number(articleId),
                commentId: commentId,
                reportedBy: reportedBy,
                reasonId: Number(reasonId),

            });

            await report.save();

            res.status(201).json({ message: "Report submitted successfully" });

        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
)
// Send Mail (Optional)
const sendMailtoUser = async (email) => {

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

const sendMailtoReportUser = async (email, details, reportType) => {

    const reportTypes = reportType || 'inappropriate_content';

    const reportDetails = reportType === 'content' ?
    `<div style="padding: 15px; border: 2px solid #FF6347; background-color: #FFFAF0; border-radius: 8px;">
       <h3 style="color: #FF6347;">Reported Content:</h3>
       <p><strong>Content ID:</strong> ${details.articleId}</p>
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

// Send Report to admin

// Get all reports (later)
// Get all reports for article
// Get all reports for user
// Get all reports for comment
// Get all reports for reason
// Get all reports for assignee