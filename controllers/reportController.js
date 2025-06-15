
require('dotenv').config();
const expressAsyncHandler = require("express-async-handler");
const { ReportAction, reportActionEnum } = require("../models/admin/reportActionSchema");
const Reason = require("../models/reasonSchema");
const Article = require('../models/Articles');
const User = require("../models/UserModel");
const Comment = require('../models/commentSchema');
const Admin = require('../models/admin/adminModel');
const AdminAggregate = require('../models/events/adminContributionEvent');
const {
  sendReportUndertakenEmail,
  sendResolvedMailToVictim,
  sendResolvedMailToConvict,
  sendWarningMailToVictimOnReportDismissOrIgnore,
  sendDismissedOrIgnoreMailToConvict,
  sendInitialReportMailtoConvict,
  sendInitialReportMailtoVictim,
  sendWarningMailToConvict,
  sendRemoveContentMailToConvict,
  sendBlockConvictMail,
  sendBannedUserMail,
  sendRestoreContentMailToUser,
  sendUnblockUserMail,
  sendRestoreRequestDisapprovedMail,
  sendRestoreRequestReceivedMail
} = require('./emailservice');
const cron = require('node-cron');



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

      const reason = await Reason.findOne({id});
      if (!reason) {
        return res.status(404).json({ message: "Reason not found." });
      }

      const existingReport = await ReportAction.findOne({reasonId: reason._id});

      if(existingReport){
        return res.status(400).json({ message: "Reason is associated with a report, cannot delete" });
      }

      await Reason.findByIdAndDelete(reason._id);
      
      res.status(200).json({ message: "Reason deleted successfully.", data: reason });
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

        if (!comment || !comment.is_removed) {
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
          content: comment.content,
        }

      } else {
        details = {
          articleId: article._id,
          title: article.title,
          content: article.title,
        }
      }

      const report = new ReportAction({
        articleId: Number(articleId),
        commentId: commentId,
        reportedBy: reportedBy,
        reasonId: reasonId,
        convictId: authorId
      });
      author.activeReportCount += 1;
      report.last_action_date = new Date();
      await author.save();
      await report.save();

      // send mail to user
      await sendInitialReportMailtoVictim(user.email);

      // send mail to censurable
      if (details) {
        await sendInitialReportMailtoConvict(author.email, details, reportType);

        if (author.activeReportCount >= 3 && !author.isBlockUser) {
          author.isBlockUser = true;
          author.blockedAt = new Date();
          await sendBlockConvictMail(author.email, details, reportType, "3 active reports have been filed against your account.")
        }
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
          action_taken: reportActionEnum.PENDING,
          admin_id: null
        })
        .populate({
          path: 'reportedBy',
          select: 'user_name',
        })
        .populate({
          path: 'convictId',
          select: 'user_name',
        })
        .populate({
          path: 'reasonId',
          select: 'reason',
        }).
        populate({
          path: "articleId",
          select: "title status pb_recordId authorId"
        }).
        populate({
          path: "commentId",
          select: "content"
        }).
        lean();

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

    const { isCompleted } = req.query;
    try {


      if (isCompleted) {

        const pendingReports = await ReportAction.find(
          {
            admin_id: req.userId,
            action_taken: {
              $in: [reportActionEnum.RESOLVED,
              reportActionEnum.DISMISSED,
              reportActionEnum.IGNORE,
              reportActionEnum.WARN_CONVICT,
              reportActionEnum.REMOVE_CONTENT,
              reportActionEnum.BLOCK_CONVICT]
            }
          })
          .populate({
            path: 'reportedBy',
            select: 'user_name',
          })
          .populate({
            path: 'convictId',
            select: 'user_name',
          })
          .populate({
            path: 'reasonId',
            select: 'reason',
          }).
          populate({
            path: "articleId",
            select: "title status pb_recordId authorId"
          }).
          populate({
            path: "commentId",
            select: "content"
          }).
          lean();

        return res.status(200).json(pendingReports);

      }
      const pendingReports = await ReportAction.find(
        {
          admin_id: req.userId,
          action_taken: {
            $nin: [reportActionEnum.RESOLVED,
            reportActionEnum.DISMISSED,
            reportActionEnum.IGNORE,
            reportActionEnum.WARN_CONVICT,
            reportActionEnum.REMOVE_CONTENT,
            reportActionEnum.BLOCK_CONVICT]
          }
        })
        .populate({
          path: 'reportedBy',
          select: 'user_name',
        })
        .populate({
          path: 'convictId',
          select: 'user_name',
        })
        .populate({
          path: 'reasonId',
          select: 'reason',
        }).
        populate({
          path: "articleId",
          select: "title status pb_recordId authorId"
        }).
        populate({
          path: "commentId",
          select: "content"
        }).
        lean();

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
          path: 'convictId',
          select: 'user_name',
        })
        .populate({
          path: 'reasonId',
          select: 'reason',
        }).
        populate({
          path: "articleId",
          select: "title status pb_recordId authorId"
        }).
        populate({
          path: "commentId",
          select: "content"
        }).
        lean();

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
      })
        .populate({
          path: 'reasonId',
          select: 'reason',
        })
        .exec();
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }
      report.admin_id = req.userId;
      report.action_taken = reportActionEnum.INVESTIGATION;
      report.last_action_date = new Date();

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

/** Take action */
module.exports.takeAdminActionOnReport = expressAsyncHandler(
  async (req, res) => {
    const { reportId, action, admin_id, dismissReason } = req.body;

    if (!reportId || !action || !admin_id) {
      return res.status(400).json({ message: 'Missing required field: Report id, action and admin id' });
    }

    if (action.toString() === reportActionEnum.DISMISSED && !dismissReason) {
      return res.status(400).json({ message: 'Dismiss reason is required' });
    }

    try {
      const [report, admin] = await Promise.all([
        ReportAction.findById(reportId).populate({
          path: 'reasonId',
          select: 'reason',
        }).populate({
          path: 'articleId',
          select: 'title status pb_recordId authorId',
        })
          .populate({
            path: 'commentId',
            select: 'content',
          })
          .exec(),
        Admin.findById(admin_id)
      ]);

      if (!report || !admin) {
        return res.status(404).json({ message: 'Report or moderator not found' });
      }



      /*
      if (report.admin_id !== null && report.admin_id !== admin._id) {
        return res.status(403).json({ message: 'Report already picked by another moderator' });
      }
        */

      if (
        report.action_taken === reportActionEnum.RESOLVED ||
        report.action_taken === reportActionEnum.DISMISSED ||
        report.action_taken === reportActionEnum.IGNORE ||
        report.action_taken === reportActionEnum.WARN_CONVICT ||
        report.action_taken === reportActionEnum.REMOVE_CONTENT ||
        report.action_taken === reportActionEnum.BLOCK_CONVICT

      ) {

        return res.status(400).json({
          success: false,
          message: `This report (Issue No. ${report.id}) has already been resolved with status: ${report.action_taken}.`,
        });
      }

      const [convict, victim] = await Promise.all([
        User.findById(report.convictId),
        User.findById(report.reportedBy)
      ]);

      if (!convict || !victim) {
        return res.status(404).json({ message: 'Convict or victim not found' });
      }

      if (convict.isBlockUser || victim.isBlockUser) {
        // Ignore Report
        report.action_taken = reportActionEnum.IGNORE;
        convict.activeReportCount = Math.max(0, convict.activeReportCount - 1);
        report.last_action_date = new Date();
        await report.save();
        await convict.save();


        return res.status(403).json({ message: 'Convict or victim is blocked' });
      }

      if (convict.isBannedUser || victim.isBannedUser) {
        // Ignore Report
        report.action_taken = reportActionEnum.IGNORE;
        report.last_action_date = new Date();
        await report.save();
        await convict.save();
        return res.status(403).json({ message: 'Convict or victim is banned' });

      }

      const details = {
        articleId: report.articleId._id,
        content: report.commentId ? report.commentId.content : report.articleId.title,
        commentId: report.commentId ? report.commentId._id : null,
      }
      const reportType = report.commentId ? 'comment' : 'content';
      switch (action.toString()) {

        case reportActionEnum.RESOLVED: {
          report.action_taken = reportActionEnum.RESOLVED;
          convict.activeReportCount = Math.max(0, convict.activeReportCount - 1);

          report.last_action_date = new Date();
          await report.save();
          await convict.save();
          // Increase moderator contribution count
          const aggregate = new AdminAggregate({
            userId: admin._id,
            contributionType: 3,
          });

          await aggregate.save();
          // Send resolved mail to convict and victim
          await sendResolvedMailToConvict(convict.email, details, reportType);
          await sendResolvedMailToVictim(victim.email, details, reportType, action);

          break;
        }

        case reportActionEnum.DISMISSED: {

          report.action_taken = reportActionEnum.DISMISSED;
          convict.activeReportCount = Math.max(0, convict.activeReportCount - 1);

          victim.reportFeatureMisuse = victim.reportFeatureMisuse + 1;

          // If the victim has reported feature misuse 3 times, block them
          if (victim.reportFeatureMisuse >= 3) {
            victim.isBlockUser = true;
            victim.blockedAt = new Date();
          }
          await victim.save();
          report.last_action_date = new Date();
          await report.save();
          await convict.save();

          await sendWarningMailToVictimOnReportDismissOrIgnore(victim.email, details, reportType, dismissReason, Math.max(victim.reportFeatureMisuse - 1, 0));
          await sendDismissedOrIgnoreMailToConvict(convict.email, details, reportType);
          // Increase moderator contribution count
          const aggregate = new AdminAggregate({
            userId: admin._id,
            contributionType: 3,
          });

          await aggregate.save();

          break;
        }

        case reportActionEnum.IGNORE: {

          report.action_taken = reportActionEnum.IGNORE;
          convict.activeReportCount = Math.max(0, convict.activeReportCount - 1);
          report.last_action_date = new Date();
          await report.save();

          await convict.save();

          break;
        }

        case reportActionEnum.WARN_CONVICT: {

          report.action_taken = reportActionEnum.WARN_CONVICT;

          convict.activeReportCount = Math.max(0, convict.activeReportCount - 1);
          convict.strikeCount = convict.strikeCount + 1;

          if (convict.strikeCount >= 3) {
            // ban the user
            convict.isBannedUser = true;
          }
          report.last_action_date = new Date();
          // For warning will not decrease report count
          await convict.save();
          await report.save();


          // Remove that content
          if (report.commentId) {
            // Remove comment
            const comment = await Comment.findById(report.commentId._id);
            comment.is_removed = true;

            await comment.save();
          } else {
            // Remove post
            const art = await Article.findById(report.articleId._id);
            art.is_removed = true;
            art.reportId = report._id;
            await art.save();
          }

          // send warn mail to convict, and resolve mail to victim 
          sendWarningMailToConvict(convict.email, details, reportType, report.reasonId.reason, Math.max(0, convict.strikeCount - 1));
          sendResolvedMailToVictim(victim.email, details, reportType, action);
          // Increase admin contribution count
          const aggregate = new AdminAggregate({
            userId: admin._id,
            contributionType: 3,
          });

          await aggregate.save();
          break;
        }
        case reportActionEnum.REMOVE_CONTENT: {
          report.action_taken = reportActionEnum.REMOVE_CONTENT;

          // Remove that content
          if (report.commentId) {
            // Remove comment
            const comment = await Comment.findById(report.commentId._id);
            comment.is_removed = true;

            await comment.save();
          } else {
            // Remove post
            const art = await Article.findById(report.articleId._id);
            art.is_removed = true;
            art.reportId = report._id;
            await art.save();
          }
          convict.activeReportCount = Math.max(0, convict.activeReportCount - 1);
          report.last_action_date = new Date();
          await report.save();
          await convict.save();

          // warn convict
          sendRemoveContentMailToConvict(convict.email, details, reportType, report.reasonId.reason);
          // send resolve mail to admin
          sendResolvedMailToVictim(victim.email, details, reportType, action);

          // increase moderator contribution count
          const aggregate = new AdminAggregate({
            userId: admin._id,
            contributionType: 3,
          });

          await aggregate.save();
          break;
        }

        case reportActionEnum.BLOCK_CONVICT: {

          report.action_taken = reportActionEnum.BLOCK_CONVICT;
          convict.activeReportCount = Math.max(0, convict.activeReportCount + 1);
          convict.isBlockUser = true;
          convict.blockedAt = new Date(); // Temporary block for 1 month
          report.last_action_date = new Date();
          await report.save();
          await convict.save();

          // Increase moderator contribution count
          const aggregate = new AdminAggregate({
            userId: admin._id,
            contributionType: 3,
          });

          // Send mail to convict and victim
          await aggregate.save();
          await sendBlockConvictMail(convict.email, details, reportType, report.reasonId.reason);
          await sendResolvedMailToVictim(victim.email, details, reportType, action);
          break;
        }
        case reportActionEnum.RESTORE_CONTENT: {

          report.action_taken = reportActionEnum.RESTORE_CONTENT;
          // Restore post
          const art = await Article.findById(report.articleId._id);
          art.is_removed = false;
          art.reportId = null;
          await art.save();
          report.last_action_date = new Date();
          await report.save();
          await convict.save();

          // warn convict
          await sendRestoreContentMailToUser(convict.email, report.articleId.title);
          break;
        }
        case reportActionEnum.BAN_CONVICT: {

          report.action_taken = reportActionEnum.BAN_CONVICT;
          convict.activeReportCount = Math.max(0, convict.activeReportCount - 1);
          convict.isBannedUser = true; // Permanent banned account
          report.last_action_date = new Date();
          await report.save();
          await convict.save();

          // Increase moderator contribution count
          const aggregate = new AdminAggregate({
            userId: admin._id,
            contributionType: 3,
          });

          // Send mail to convict and victim
          await aggregate.save();
          // Send Ban convict mail 
          await sendBannedUserMail(convict.email, details, reportType, report.reasonId.reason);
          // await sendBlockConvictMail(convict.email, details, reportType, report.reasonId.reason);
          await sendResolvedMailToVictim(victim.email, details, reportType, action);
          break;
        }
        case reportActionEnum.CONVICT_REQUEST_DISAPPROVED: {
          report.last_action_date = new Date();
          await report.save();
          await sendRestoreRequestDisapprovedMail(convict.email, report.articleId.title);
          break;
        }
        default: {
          return res.status(400).json({ message: "Invalid action" });
        }
      }

      if (convict.activeReportCount < 3 && convict.isBlockUser && action.toString() !== reportActionEnum.BLOCK_CONVICT) {
        convict.isBlockUser = false;
        convict.blockedAt = null;
        await convict.save();
        await sendUnblockUserMail(convict.email, convict.user_name);
      }

      return res.status(200).json({ message: "Action performed" });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error taking action on report' });
    }

  }
)

/** Submit request to restore content */
module.exports.convictRequestToRestoreContent = expressAsyncHandler(
  async (req, res) => {
    const { convict_id, convict_statement, report_id } = req.body;

    if (!convict_id || !convict_statement || !report_id) {
      return res.status(400).json({ message: "Convict id, convict statement and report id are required" });
    }

    try {


      const convict = await User.findOne({ _id: convict_id });
      const report = await ReportAction.findOne({ _id: report_id });

      if (!convict || !report) {
        return res.status(400).json({ message: "Convict or report not found" });
      }

      if (report.convictId !== convict.id) {
        return res.status(400).json({ message: "Convict does not match report" });
      }
      if (report.commentId) {
        return res.status(400).json({ message: "Comment is already resolved" });
      }

      const article = await Article.findOne({ _id: report.articleId });
      if (!article) {
        return res.status(400).json({ message: "Article not found" });
      }
      report.action_taken = reportActionEnum.CONVICT_REQUEST_TO_RESTORE_CONTENT;
      report.convict_statement = convict_statement;
      report.last_action_date = new Date();
      await report.save();

      // Send email to user to inform them of the request to restore content
      await sendRestoreRequestReceivedMail(convict.email, article.title);

      return res.status(200).json({ message: "Request sent" });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error convicting user' });
    }

  }
)

/** GET ALL REPORTS AGAINST CONVICT */
module.exports.getAllReportsAgainstConvict = expressAsyncHandler(
  async (req, res) => {

    try {

      const reports = await ReportAction.find({
        convictId: req.userId, status: {
          $in: [reportActionEnum.RESOLVED,
          reportActionEnum.DISMISSED,
          reportActionEnum.IGNORE,
          reportActionEnum.WARN_CONVICT,
          reportActionEnum.REMOVE_CONTENT,
          reportActionEnum.BLOCK_CONVICT]
        }
      }).populate({
        path: 'reasonId',
        select: 'reason',
      }).
        populate({
          path: "articleId",
          select: "title status pb_recordId authorId"
        }).
        populate({
          path: "commentId",
          select: "content"
        }).
        lean();

      return res.status(200).json(reports);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error fetching reports' });
    }
  }

)

async function unBlockUser() {

  try {

    const users =
      await User.find({
        isBlockUser: true,
        blockedAt: {
          $gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago in milliseconds
          $lte: new Date() // Current date
        }
      });

    for (const user of users) {

      if (user) {
        user.isBlockUser = false;
        user.blockedAt = null;
        await sendUnblockUserMail(user.email, user.user_name);
      }
    }

  } catch (err) {
    console.error(err);

  }
}

cron.schedule('0 0 * * *', async () => {

  console.log('running cron job discard article...');
  await unBlockUser();
});










// Task Left:

// Admin action effect on user both frontend and backend (MOST Important part)

// Overall test

// Mail request to restore article content
