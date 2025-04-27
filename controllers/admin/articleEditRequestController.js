const expressAsyncHandler = require('express-async-handler');
const Article = require('../../models/Articles');
const EditRequest = require('../../models/admin/articleEditRequestModel');
const admin = require('../../models/admin/adminModel');
const User = require('../../models/UserModel');
const { articleReviewNotificationsToUser } = require('../notifications/notificationHelper');
const Comment = require('../../models/commentSchema');
const WriteAggregate = require("../../models/events/writeEventSchema");
const { sendMailOnEditRequestApproval } = require('../emailservice');
const cron = require('node-cron');
const statusEnum = require('../../utils/StatusEnum');
const AdminAggregate = require('../../models/events/adminContributionEvent');
const diff= require('diff');
// Flow

// Submit Edit request
module.exports.submitEditRequest = expressAsyncHandler(

    async (req, res) => {

        const { article_id, edit_reason } = req.body;

        const userId = req.userId;

        if (!article_id || !edit_reason || !userId) {
            return res.status(400).json({ message: "Article Id , User Id, Edit Reason required" });
        }

        try {

            const article = await Article.findById(Number(article_id));

            if(!article){
                return res.status(404).json({message:"Article not found"});
            }
            // User can have 2 open edit request at  a time
            const count = await EditRequest.countDocuments({
                user_id: userId, status: {
                    $ne: [statusEnum.statusEnum.PUBLISHED, statusEnum.statusEnum.DISCARDED]
                }
            });

            if (count > 2) {
                return res.status(403).json({ message: "You are not permitted to submit edit request at this moment" });
            }

            // Create edit request
            const editRequest = new EditRequest({
                user_id: userId,
                article: Number(article_id),
                edit_reason: edit_reason
            });
            await editRequest.save();

            return res.status(200).json({ message: "Your edit request has been successfully created and is being processed." });

        } catch (err) {
            console.log("Error", err);
            res.status(500).json({ message: "Internal server error" });
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
        const reviewer_id = req.userId;
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
        const reviewer_id = req.userId;
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

            if (!user) {
                return res.status(400).json({ message: "User not found" });
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
            }, 1);

            // Send email
            sendMailOnEditRequestApproval(user.email, editRequest.article.title);

            res.status(200).json({ message: "Article status updated" });

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

// submitReview
// Alternative send email on review-comments
module.exports.submitReviewOnImprovement = expressAsyncHandler(

    async (req, res) => {

        const { requestId, reviewer_id, feedback } = req.body;

        if (!requestId || !reviewer_id || !feedback) {
            res.status(400).json({ message: 'Please fill all fields: Request Id, Reviewer id and feedback' });
            return;
        }
        try {
            const [editRequest, reviewer] = await Promise.all([
                EditRequest.findById(requestId)
                    .populate('article')
                    .populate('user_id')
                    .exec(),
                admin.findById(reviewer_id),
            ]);

            if (!editRequest || !reviewer) {
                res.status(404).json({ message: 'Request or Moderator not found' });
                return;
            }

            if (editRequest.reviewer_id !== reviewer._id) {
                res.status(403).json({ message: 'You are not authorized to access this article' });
                return;
            }

            const comment = new Comment({
                adminId: reviewer._id,
                articleId: editRequest.article._id,
                parentCommentId: null,
                content: feedback,
                isReview: true
            });

            await comment.save();
            editRequest.editComments.push(comment._id);
            editRequest.status = statusEnum.statusEnum.AWAITING_USER;
            await editRequest.save();

            articleReviewNotificationsToUser(editRequest.user_id._id, editRequest.article._id, {
                title: "New feedback received on your Article : " + editRequest.article.title,
                body: feedback
            }, 2);
            // send mail
            sendArticleFeedbackEmail(editRequest.user_id.email, feedback, editRequest.article.title);

            res.status(200).json({ message: "Review submitted" });

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

// Submit improvement by user
module.exports.submitImprovement = expressAsyncHandler(

    async (req, res) => {

        const { requestId, edited_content} = req.body;

        if (!requestId || !edited_content) {
            return res.status(400).json({ message: "Request Id, Edited Content, Author Id and Reviewer Id required" });
        }

        try {

            const editRequest = await EditRequest.findById(requestId).populate('article')
                .populate('user_id').exec();

            if(!editRequest){
                return res.status(400).json({message:"Edit request not found"});
            }
           if(editRequest.reviewer_id === null){
              return res.status(403).json({message:"The request has not been approved yet"});
           }

           editRequest.edited_content = edited_content;
           editRequest.status = statusEnum.statusEnum.REVIEW_PENDING;

           await editRequest.save();

        if (editRequest.reviewer_id) {
           
            articleReviewNotificationsToUser(editRequest.reviewer_id, editRequest.article._id, {
            title: ` New changes from author on : ${editRequest.article.title} `,
            body: "Please reach out"
            },1);
        
         }
         
         res.status(200).json({ message: "Improvement submitted" });

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Internal server error" });
        }

    }
)

// Detect content loss, Later may replace with Python API
module.exports.detectContentLoss = expressAsyncHandler(

     async(req, res)=>{
         
        const {edited_content, requestId} = req.body;

        if(!edited_content  || !requestId){
            res.status(400).json({message:"Missing edited content or request id"});
            return;
        }

        try{

            const editRequest = await EditRequest.findById(requestId).populate('article')
                .populate('user_id').exec();

            if(!editRequest){
                return res.status(400).json({message:"Edit request not found"});
            }
            if (editRequest.reviewer_id === null) {
                return res.status(403).json({ message: "The request has not been approved yet." });
            }
            const original_content = editRequest.article.content;
            

            const differences = diff.diffWords(original_content, edited_content);
            const removedParts = differences.filter(part => part.removed);

            if (removedParts.length > 0) {
                return res.status(400).json({ 
                    message: "Some content from the original article was removed.",
                    status: true,
                    parts: removedParts
                });
            }else{
                return res.status(400).json({ 
                    message: "No removed content",
                    status: false
                }); 
            }

        }catch(err){
            console.log(err);
            res.status(500).json({message: "Internal server error"});
        }
     }
)

module.exports.discardImprovement = expressAsyncHandler(
    async (req, res) => {

        const { requestId, discardReason } = req.body;

        if (!requestId || !discardReason) {
            return res.status(400).json({ message: "Invalid request, please provide discard reason and request id" });
        }

        try {

            const editRequest = await EditRequest.findById(requestId).populate('article')
                                 .populate('user_id').exec();

            if (!editRequest) {
                return res.status(404).json({ message: "Request not found" });
            }

        
       
            editRequest.reviewer_id = null;
            editRequest.status = statusEnum.statusEnum.DISCARDED;

            await editRequest.save();
           
              
            sendMailArticleDiscardByAdmin(editRequest.user_id.email, editRequest.article.title, discardReason);
            

            return res.status(200).json({message:"Improvement Discarded"});

        } catch (err) {
            console.error(err);
            res.status(500).json({ message: err.message });
        }
    }
)
// Moderator will review the reason

module.exports.publishArticle = expressAsyncHandler(
    async (req, res) => {
        const { requestId, reviewer_id } = req.body;

        if (!requestId || !reviewer_id) {
            return res.status(400).json({ message: "Request ID and Reviewer ID are required" });
        }

        try {
            const [editRequest, reviewer] = await Promise.all([
                EditRequest.findById(requestId).populate('article').populate('user_id').exec(),
                admin.findById(reviewer_id)
            ]);

            if (!editRequest || !reviewer) {
                return res.status(404).json({ message: "Request or Reviewer not found" });
            }

            if (editRequest.reviewer_id.toString() !== reviewer_id) {
                return res.status(403).json({ message: "Article is not assigned to this reviewer" });
            }
            
            article.status = statusEnum.statusEnum.PUBLISHED;
            article.publishedDate = new Date();
            article.lastUpdated = new Date();

            await article.save();
            // user.articles.push(article._id);

            await updateWriteEvents(article._id, user.id);
            
            // Update admin contribution for publish new article
            const aggregate = new AdminAggregate({
                userId: article.reviewer_id,
                contributionType: 1,
            });

            await  aggregate.save();

            // send mail to user
            sendArticlePublishedEmail(user.email, "", article.title);

            // send notification
            articleReviewNotificationsToUser(user._id, article._id, {
                title: ` Your Article : ${article.title} is Live now!`,
                body: "Keep contributing!  We encourage you to keep sharing valuable content with us."
            },2);

            res.status(200).json({ message: "Article Published" });

        } catch (err) {
            console.error(err);
            res.status(500).json({ message: err.message });
        }
    }
)
// Moderator will assign the new contributor who has requested
// Interaction Start
// If all good moderator will published the article with changes, and User will be added as an
// contributor to the article