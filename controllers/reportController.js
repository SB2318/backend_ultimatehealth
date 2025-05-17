
require('dotenv').config();
const expressAsyncHandler = require("express-async-handler");
const { ReportAction, reportActionEnum } = require("../models/admin/reportActionSchema");
const Reason = require("../models/reasonSchema");
const Article = require('../models/Articles');
const User = require("../models/UserModel");
const Comment = require('../models/commentSchema');
const Admin = require('../models/admin/adminModel');
const { sendReportUndertakenEmail, sendInitialReportMailtoConvict, sendInitialReportMailtoVictim  } = require('./emailservice');



// Add Reason
module.exports.addReason = expressAsyncHandler(

  async (req, res) => {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Please add a reason." });
    }

    try {
      //await Reason.create({ reason }); SQL dilemma
      const newReason = new Reason({ reason });
      await newReason.save();
      res.status(201).json({ message: "Reason added successfully." });
    } catch (err) {
      console.log(err);
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
      const reasonDb = await Reason.findById(id);
      if (!reasonDb) {
        return res.status(404).json({ message: "Reason not found." });
      }
      reasonDb.reason = reason;
      await reasonDb.save();
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
      const reason = await Reason.deleteOne({ _id: Number(id) });
      if (!reason) {
        return res.status(404).json({ message: "Reason not found." });
      }

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
      const reasons = await Reason.find({ status: 'Active' }).sort({ createdAt: -1 });
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

    const { articleId, commentId, reportedBy, reasonId, authorId } = req.body;

    //console.log("Reason Id", reasonId);

    if (!articleId || !reportedBy || !reasonId || !authorId) {
      return res.status(400).json({ message: "Please fill in all fields." });
    }

    try {

      const [article, user, reason, author] = await Promise.all(
        [
          Article.findById(Number(articleId)),
          User.findById(reportedBy),
          Reason.findById(reasonId),
          User.findById(authorId)
        ]
      );

      let comment;
      if (commentId) {
        comment = await Comment.findById(commentId);

        if (!comment) {
          return res.status(404).json({ message: "Comment not found." });
        }
      }

      if (!author) {
        return res.status(404).json({ message: "Author of the content not found." });
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


      let reportType = comment ? 'comment' : 'content';
      let details;

      if (comment) {
        details = {
          commentId: comment._id,
          comment: comment.content,
        }

      } else {
        details = {
          articleId: article._id,
          title: article.title
        }
      }

      const report = new ReportAction({
        articleId: Number(articleId),
        commentId: commentId,
        reportedBy: reportedBy,
        reasonId: reasonId,
      });

      await report.save();

      // send mail to user
      await sendInitialReportMailtoVictim(user.email);

      // send mail to censurable
      if (details) {
        await sendInitialReportMailtoConvict(author.email, details, reportType);
      }

      res.status(201).json({ message: "Report submitted successfully" });

    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
)


/** To get all avilable reports */
module.exports.getAllPendingReports = expressAsyncHandler(
  async (req, res) => {

    try {

      const pendingReports = await ReportAction.find(
        {
          status: reportActionEnum.PENDING,
          admin_id: null
        })
        .populate({
          path: 'reportedBy',
          select: 'user_name',
        })
        .populate({
          path: 'reasonId',
          select: 'reason',
        }).
        populate({
          path: "articleId",
          select: "title"
        }).
        populate({
          path: "commentId",
          select: "content"
        }).
        exec();

      return res.status(200).json(pendingReports);

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error fetching pending reports' });
    }
  }
)

/** To get rest of reports */
module.exports.getAllReportsForModerator = expressAsyncHandler(
  async (req, res) => {

    try {

      const pendingReports = await ReportAction.find(
        {
          admin_id: req.userId
        })
        .populate({
          path: 'reportedBy',
          select: 'user_name',
        })
        .populate({
          path: 'reasonId',
          select: 'reason',
        }).
        populate({
          path: "articleId",
          select: "title"
        }).
        populate({
          path: "commentId",
          select: "content"
        }).
        exec();

      return res.status(200).json(pendingReports);

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error fetching pending reports' });
    }
  }
)

/** To get single report details */
module.exports.getReportDetails = expressAsyncHandler(
  async (req, res) => {

    const id = req.params.id;

    if (!id) {
      return res.status(400).json({ message: 'Report id is required' });
    }

    try {
      // view article or comment
      const report = await ReportAction.findById(id)
        .populate({
          path: 'reportedBy',
          select: 'user_name',
        })
        .populate({
          path: 'reasonId',
          select: 'reason',
        }).
        populate({
          path: "articleId",
          select: "title"
        }).
        populate({
          path: "commentId",
          select: "content"
        }).
        exec();

      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }

      return res.status(200).json(report);

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error fetching report details' });
    }
  }
)

/** Pick report or assign moderator */
module.exports.pickReport = expressAsyncHandler(
  async (req, res) => {
    const { reportId } = req.body;

    if (!reportId) {
      return res.status(400).json({ message: 'Report id is required' });
    }

    try {

      const report = await ReportAction.findById(reportId).populate({
        path: 'reportedBy',
        select: 'user_name, email',
      }).exec();
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }
      report.admin_id = req.userId;
      report.action_taken = reportActionEnum.INVESTIGATION;

      await report.save();

      /** Send Mail to user */
       sendReportUndertakenEmail(report.reportedBy.email, report._id);
      return res.status(200).json({ message: 'Report picked successfully' });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error picking report' });
    }
  }
)




// Get all reports (later)
// Get all reports for article
// Get all reports for user
// Get all reports for comment
// Get all reports for reason
// Get all reports for assignee