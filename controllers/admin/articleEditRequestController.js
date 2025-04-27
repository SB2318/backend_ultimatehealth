const expressAsyncHandler = require('express-async-handler');
const Article = require('../../models/Articles');
const EditRequest = require('../../models/admin/articleEditRequestModel');
const admin = require('../../models/admin/adminModel');
const User = require('../../models/UserModel');
const { articleReviewNotificationsToUser } = require('../notifications/notificationHelper');
const Comment = require('../../models/commentSchema');
const WriteAggregate = require("../../models/events/writeEventSchema");
const { sendMailOnEditRequestApproval} = require('../emailservice');
const cron = require('node-cron');
const statusEnum = require('../../utils/StatusEnum');
const AdminAggregate = require('../../models/events/adminContributionEvent');
// Flow

// Submit Edit request
module.exports.submitEditRequest = expressAsyncHandler(

    async (req, res)=>{
        
       const { article_id, edit_reason} = req.body;

       const userId = req.userId;

       if(!article_id || !edit_reason || !userId){
         return res.status(400).json({message:"Article Id , User Id, Edit Reason required"}); 
       }

       try{
      
        // User can have 2 open edit request at  a time
        const count = await EditRequest.countDocuments({user_id: userId, status: {
          $ne: [statusEnum.statusEnum.PUBLISHED, statusEnum.statusEnum.DISCARDED]
        }});

        if(count > 2){
          return res.status(403).json({message:"You are not permitted to submit edit request at this moment"});
        }

        // Create edit request
        const editRequest = new EditRequest({
            user_id: userId,
            article: Number(article_id),
            edit_reason: edit_reason
        });
        await editRequest.save();

        return res.status(200).json({message:"Your edit request has been successfully created and is being processed."});

       }catch(err){
         console.log("Error", err);
         res.status(500).json({message:"Internal server error"});
       }
    }
)

// GET Available Improvements
module.exports.getAllImprovementsForReview = expressAsyncHandler(
    async (req, res) => {
        try {
            const articles = await EditRequest.find({ status: statusEnum.statusEnum.UNASSIGNED }).populate('article').exec();
            res.status(200).json(articles);
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

//Get All in progress improvements for reviewer

module.exports.getAllInProgressImprovementsForAdmin = expressAsyncHandler(
    async (req, res) => {
        const reviewer_id  = req.userId;
        if (!reviewer_id) {
            return res.status(400).json({ message: 'Reviewer ID is required.' });
        }
        try {
            const articles = await EditRequest.find({
                reviewer_id: reviewer_id, status: {
                    $in: [statusEnum.statusEnum.IN_PROGRESS, statusEnum.statusEnum.AWAITING_USER, statusEnum.statusEnum.REVIEW_PENDING]
                }
            }).populate('article').exec();

            res.status(200).json(articles);
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)
// Get All completed improvements for reviewer
module.exports.getAllCompletedImprovementsForAdmin = expressAsyncHandler(
    async (req, res) => {
        const reviewer_id  = req.userId;
        if (!reviewer_id) {
            return res.status(400).json({ message: 'Reviewer ID is required.' });
        }
        try {
            const articles = await EditRequest.find({
                reviewer_id: reviewer_id, status: {
                    $in: [statusEnum.statusEnum.PUBLISHED]
                }
            }).populate('article').exec();

            res.status(200).json(articles);
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)


// assignModerator or startReview
module.exports.pickImprovementRequest = expressAsyncHandler(

    async (req, res) => {

        const { requestId, reviewerId } = req.body;

        if (!requestId || !reviewerId) {
            res.status(400).json({ message: 'Please provide Request Id and Reviewer Id' });
            return;
        }

        try {
            const [editRequest, moderator] = await Promise.all(
                [
                    EditRequest.findById(requestId).populate('article').exec(),
                    admin.findById(reviewerId),
                ]
            );

           

            if (!editRequest || !moderator) {
                res.status(404).json({ message: 'Request or Reviewer not found' });
                return;
            }
            const user = await User.findById(editRequest.user_id);

            if(!user){
                return res.status(400).json({message:"User not found"});
            }

            if (editRequest.status !== statusEnum.statusEnum.UNASSIGNED) {
                res.status(400).json({ message: 'Request is already picked by a moderator' });
                return;
            }

            // Update article status and assign reviewer
            editRequest.status = statusEnum.statusEnum.IN_PROGRESS;
            editRequest.reviewer_id = moderator._id;
           
            await editRequest.save();
            // send Notification
            articleReviewNotificationsToUser(editRequest.article.authorId, editRequest.article._id, {
                title: `Congrats! Your Improvement Request has been accepted`,
                body: `Article : ${editRequest.article.title}`
            },1);

            // Send email
            sendMailOnEditRequestApproval()

            res.status(200).json({ message: "Article status updated" });

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)



// Moderator will review the reason
// Moderator will assign the new contributor who has requested 
// Interaction Start
// If all good moderator will published the article with changes, and User will be added as an
// contributor to the article