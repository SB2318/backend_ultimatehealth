const expressAsyncHandler = require('express-async-handler');
const Article = require('../../models/Articles');
const EditRequest = require('../../models/admin/articleEditRequestModel');
const admin = require('../../models/admin/adminModel');
const User = require('../../models/UserModel');
const { articleReviewNotificationsToUser } = require('../notifications/notificationHelper');
const Comment = require('../../models/commentSchema');
const WriteAggregate = require("../../models/events/writeEventSchema");
const { sendMailOnEditRequestApproval, sendMailArticleDiscardByAdmin, sendArticleFeedbackEmail, sendArticlePublishedEmail } = require('../emailservice');
const cron = require('node-cron');
const statusEnum = require('../../utils/StatusEnum');
const AdminAggregate = require('../../models/events/adminContributionEvent');
const diff = require('diff');
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

            if (!article) {
                return res.status(404).json({ message: "Article not found" });
            }
            // User can have 2 open edit request at  a time
            const count = await EditRequest.countDocuments({
                user_id: userId, status: {
                    $nin: [statusEnum.statusEnum.PUBLISHED, statusEnum.statusEnum.DISCARDED]
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

            return res.status(200).json({ message: "Your edit request has been successfully created and is being processed.", data: editRequest });

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
            const articles = await EditRequest.find({ status: statusEnum.statusEnum.UNASSIGNED }).populate({
                path: 'article',
                populate: {
                    path: 'tags',
                },
            }).exec();
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
            }).populate({
                path: 'article',
                populate: {
                    path: 'tags',
                },
            }).exec();

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
            }).populate({
                path: 'article',
                populate: {
                    path: 'tags',
                },
            }).exec();

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
            editRequest.last_updated = new Date();

            await editRequest.save();
            // send Notification
            if (editRequest.article._id && editRequest.article.title) {

                articleReviewNotificationsToUser(editRequest.article.authorId, editRequest.article._id, {
                    title: `Congrats! Your Improvement Request has been accepted`,
                    body: `Article : ${editRequest.article.title}`
                }, 1);

                // Send email
                sendMailOnEditRequestApproval(user.email, editRequest.article.title);
            }

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

            if (editRequest.article._id && editRequest.article.title && editRequest.user_id._id && editRequest.user_id.email) {

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
                editRequest.last_updated = new Date();
                await editRequest.save();


                articleReviewNotificationsToUser(editRequest.user_id._id, editRequest.article._id, {
                    title: "New feedback received on your Article : " + editRequest.article.title,
                    body: feedback
                }, 2);
                // send mail
                sendArticleFeedbackEmail(editRequest.user_id.email, feedback, editRequest.article.title);

                res.status(200).json({ message: "Review submitted" });

            } else {
                res.status(400).json({ message: "Article or author not found" });
            }

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

// Submit improvement by user
module.exports.submitImprovement = expressAsyncHandler(

    async (req, res) => {

        const { requestId, edited_content } = req.body;

        if (!requestId || !edited_content) {
            return res.status(400).json({ message: "Request Id, Edited Content, Author Id and Reviewer Id required" });
        }

        try {

            const editRequest = await EditRequest.findById(requestId).populate('article')
                .populate('user_id').exec();

            if (!editRequest) {
                return res.status(400).json({ message: "Edit request not found" });
            }
            if (editRequest.reviewer_id === null) {
                return res.status(403).json({ message: "The request has not been approved yet" });
            }

            editRequest.edited_content = edited_content;
            editRequest.status = statusEnum.statusEnum.REVIEW_PENDING;
            editRequest.last_updated = new Date();

            await editRequest.save();

            if (editRequest.reviewer_id && editRequest.article._id && editRequest.article.title) {

                articleReviewNotificationsToUser(editRequest.reviewer_id, editRequest.article._id, {
                    title: ` New changes from author on : ${editRequest.article.title} `,
                    body: "Please reach out"
                }, 1);

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

    async (req, res) => {

        const { requestId } = req.query;

        if (!requestId) {
            res.status(400).json({ message: "Missing  request id" });
            return;
        }

        try {

            const editRequest = await EditRequest.findById(requestId).populate('article')
                .populate('user_id').exec();

            if (!editRequest) {
                return res.status(400).json({ message: "Edit request not found" });
            }
            if (editRequest.reviewer_id === null) {
                return res.status(403).json({ message: "The request has not been approved yet." });
            }

            let original_content = '';
            if(editRequest.article.content.endsWith('.html')){
                  original_content = await getContent(editRequest.article.content);
            }
            else{
                original_content = editRequest.article.content;
            }

            const differences = diff.diffWords(original_content, editRequest.edited_content);

            const htmlDiff = differences.map((part) => {

                const bg = part.added ? '#c8facc' : part.removed ? '#fdd' : 'transparent';
                const tag = part.added ? 'ins' : part.removed ? 'del' : 'span';
                return `<${tag} style="background-color:${bg}; padding:2px;">${escapeHtml(part.value)}</${tag}>`;
            }).join('');

            return res.status(200).json({
                status: true,
                diff: htmlDiff
            });

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Internal server error" });
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
            editRequest.last_updated = new Date();

            await editRequest.save();


            if (editRequest.user_id.email && editRequest.article.title) {
                sendMailArticleDiscardByAdmin(editRequest.user_id.email, editRequest.article.title, discardReason);
            }

            return res.status(200).json({ message: "Improvement Discarded" });

        } catch (err) {
            console.error(err);
            res.status(500).json({ message: err.message });
        }
    }
)
// Moderator will review the reason

module.exports.publishImprovement = expressAsyncHandler(
    async (req, res) => {
        const { requestId, reviewer_id } = req.body;

        if (!requestId || !reviewer_id) {
            return res.status(400).json({ message: "Request ID and Reviewer ID are required" });
        }

        try {
            const [editRequest, reviewer] = await Promise.all([
                EditRequest.findById(requestId),
                admin.findById(reviewer_id)
            ]);


            if (!editRequest || !reviewer) {
                return res.status(404).json({ message: "Request or Reviewer not found" });
            }


            if (editRequest.reviewer_id.toString() !== reviewer_id) {
                return res.status(403).json({ message: "Article is not assigned to this reviewer" });
            }

            const [article, contributor] = await Promise.all([
                Article.findById(editRequest.article),
                User.findById(editRequest.user_id)
            ])

            if (!article || !contributor) {
                return res.status(400).json({ message: "Article or contributor not found" });
            }

            article.status = statusEnum.statusEnum.PUBLISHED;
            //  article.publishedDate = new Date();
            article.content = editRequest.edited_content;
            article.lastUpdated = new Date();
            article.contributors.push(contributor._id);
            // update contributor improvement section
            contributor.improvements.push(article._id);

            await article.save();
            await contributor.save();
            // update user contribution
            await updateWriteEvents(article._id, contributor.id);

            // Update admin contribution for publish new article
            const aggregate = new AdminAggregate({
                userId: article.reviewer_id,
                contributionType: 2,
            });

            await aggregate.save();

            // send mail to user
            sendArticlePublishedEmail(contributor.email, "", article.title);

            // send notification
            articleReviewNotificationsToUser(contributor._id, article._id, {
                title: ` Your Improvements on article : ${article.title} is Live now!`,
                body: "Keep contributing! We encourage you to keep sharing valuable content with us."
            }, 2);

            res.status(200).json({ message: "Article Published" });

        } catch (err) {
            console.error(err);
            res.status(500).json({ message: err.message });
        }
    }
)

// moderator self unassign 
module.exports.unassignModerator = expressAsyncHandler(
    async (req, res) => {

        const { requestId } = req.body;

        if (!requestId) {
            return res.status(400).json({ message: "Request id required" });
        }

        try {

            const editRequest = await EditRequest.findById(requestId);

            if (!editRequest) {
                return res.status(400).json({ message: "request not found" });
            }

            if (editRequest.status === statusEnum.statusEnum.PUBLISHED) {
                return res.status(403).json({ message: "Improvement already published" });
            }

            editRequest.reviewer_id = null;
            editRequest.status = statusEnum.statusEnum.UNASSIGNED;
            editRequest.last_updated = new Date();

            await editRequest.save();

            return res.status(200).json({ message: "Unassigned moderator" });


        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Internal server error" });
        }

    }
)

async function updateWriteEvents(articleId, userId) {

    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));

    try {

        // Check for existing event entry
        const writeEvent = await WriteAggregate.findOne({ userId: userId, date: today });

        if (!writeEvent) {
            // New Write Event Entry
            const newWriteEvent = new WriteAggregate({ userId: userId, date: today });
            newWriteEvent.dailyWrites = 1;
            newWriteEvent.monthlyWrites = 1;
            newWriteEvent.yearlyWrites = 1;

            await newWriteEvent.save();
        } else {

            writeEvent.dailyWrites += 1;
            writeEvent.monthlyWrites += 1;
            writeEvent.yearlyWrites += 1;

            await writeEvent.save();
        }
    } catch (err) {
        console.log('Article Write Event Update Error', err);
    }
}

async function discardImprovements() {

    try {
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const editRequests = await EditRequest.find({
            status: {
                $in: [statusEnum.statusEnum.UNASSIGNED, statusEnum.statusEnum.REVIEW_PENDING,
                statusEnum.statusEnum.AWAITING_USER]
            },
            last_updated: {
                $lte: sixtyDaysAgo
            },

        }).populate('article').populate('user_id').exec();


        for (const editRequest of editRequests) {

            editRequest.reviewer_id = null;
            editRequest.status = statusEnum.statusEnum.DISCARDED;

            await editRequest.save();

            if (editRequest.user_id.email && editRequest.article.title) {
                sendMailArticleDiscardByAdmin(editRequest.user_id.email, editRequest.article.title, "Discarded by system");
            }

        }

    } catch (err) {
        console.error(err);
    }
}


async function unassignImprovements() {

    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 30);

        const requests = await EditRequest.find({
            status: {
                $in: [statusEnum.statusEnum.IN_PROGRESS]
            },
            last_updated: {
                $lte: thirtyDaysAgo
            }
        });

        requests.forEach(async (request) => {

            request.reviewer_id = null;
            request.status = statusEnum.statusEnum.UNASSIGNED;
            request.last_updated = new Date();

            await request.save();

        });

    } catch (err) {

        console.error(err);

    }
}


cron.schedule('0 0 * * *', async () => {

    console.log('running cron job unassign article...');
    await unassignImprovements();
});

cron.schedule('0 0 * * *', async () => {

    console.log('running cron job discard article...');
    await discardImprovements();
});


function escapeHtml(text) {

    return text.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const getContent = async content => {
    try {
      const response = await fetch(`http://51.20.1.81:8084/api/getFile/${content}`);
      const text = await response.text();
      return text;
    } catch (error) {
       console.error('Error fetching URI:', error);
    return content;
    }
  };

