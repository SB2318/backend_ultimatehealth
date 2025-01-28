const expressAsyncHandler = require('express-async-handler');
const Article = require('../../models/Articles');
const admin = require('../../models/admin/adminModel');
const User = require('../../models/UserModel');
const { articleReviewNotificationsToUser, sendCommentNotification } = require('../notifications/notificationHelper');
const Comment = require('../../models/commentSchema');
const WriteAggregate = require("../../models/events/writeEventSchema");
const { sendArticleFeedbackEmail, sendArticlePublishedEmail } = require('../emailservice');
// article review section

// getallDraftArticle
module.exports.getAllArticleForReview = expressAsyncHandler(
    async (req, res) => {
        try {
            const articles = await Article.find({ status: 'unassigned' });
            res.status(200).json(articles);
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)
// assignModerator or startReview
module.exports.assignModerator = expressAsyncHandler(

    async (req, res) => {

        const { articleId, moderatorId } = req.body;

        if (!articleId || !moderatorId) {
            res.status(400).json({ message: 'Please provide articleId and moderatorId' });
            return;
        }

        try {

         const [article, moderator] = await Promise.all(
            [
                Article.findById(Number(articleId)),
                admin.findById(moderatorId),
            ]
         );

         if (!article || !moderator) {
            res.status(404).json({ message: 'Article or Moderator not found' });
            return;
         }

         if(article.status !== 'unassigned'){
            res.status(400).json({ message: 'Article is already assigned to a moderator' });
            return;
         }

         // Update article status and assign reviewer
         article.status = "in-progress";
         article.reviewer_id = moderator._id;

         await article.save();
         // send Notification
         articleReviewNotificationsToUser(article.authorId, article._id, {
            title:`Congrats!Your Article : ${article.title} is Under Review`,
            body:"Our team has started reviewing your article. Stay tuned!"
         })

         res.status(200).json({message:"Article status updated"});

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

// submitReview
module.exports.submitReview  = expressAsyncHandler(
     
    async(req, res) =>{
        const { articleId, reviewerId, feedback } = req.body;

        if(!articleId || !reviewerId || !feedback){
            res.status(400).json({ message: 'Please fill all fields: articleId, reviewerId, reviewContent' });
            return;
        }

        try{
            
            const [article, reviewer] = await Promise.all([

                Article.findById(Number(articleId))
                .populate('authorId')
                .exec(),
                admin.findById(reviewerId),
            ]);

            if(!article || !reviewer){
                res.status(404).json({ message: 'Article or Moderator not found' });
                return;
            }

            if(article.reviewer_id !== reviewer._id){
                res.status(403).json({ message: 'You are not authorized to access this article'});
            }


            const comment = new Comment({
                adminId: reviewer._id,
                articleId: article._id,
                parentCommentId: parentCommentId || null,
                content: feedback,
                isReview: true
            });

            await comment.save();
            article.reviewComments.push(comment._id);

            article.status ="awaiting-user";

            await article.save();

            articleReviewNotificationsToUser(article.authorId._id, article._id, {
                title: "New feedback received on your Article : " + article.title,
                body: feedback
            });
            // send mail
            sendArticleFeedbackEmail(article.authorId.email, feedback, article.title);

            res.status(200).json({message:"Review submitted"});

        }catch(err){
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

// submitSuggestedChanges
module.exports.submitSuggestedChanges = expressAsyncHandler(
    async (req, res) => {

        const { userId, articleId, content, aditionalNote, title, imageUtils} = req.body;

        if(!userId || !articleId || !content  || !title || !imageUtils){
            res.status(400).json({message:"Missing required fields: articleId, content, aditionalNote, title, imageUtils"});
            return;
        }
       
        try{

             const article = await Article.findById(Number(articleId));

             if(!article){
                res.status(404).json({message:"Article not found"});
                return;
             }

             if(article.authorId !== userId){
                res.status(403).json({message:"You are not the author of this article"});
                return;
             }

             article.content = content;
             article.title = title;
             article.imageUtils = imageUtils;
             article.status = "pending";

             await article.save();

             if(aditionalNote){
                // create comment object and notify moderator
                const comment = new Comment({
                    userId: article.authorId,
                    articleId: article._id,
                    parentCommentId: parentCommentId || null,
                    content: aditionalNote,
                    isNote: true
                });
                await comment.save();

                article.reviewComments.push(comment._id);

                await article.save();

                sendCommentNotification(article.reviewer_id, article._id, {
                    title:"New Additional Note from Author",
                    body: `An author has added a new note to the article titled ${article.title}.`
                })
            
             }

             res.status(200).json({message:"Article submitted"});
             
        }catch(err){

            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

// get all articles for assigned moderator
module.exports.getAllArticlesForAssignModerator = expressAsyncHandler(
   
    async (req, res) =>{

        const {moderatorId} = req.params;

        if(!moderatorId){
            return res.status(400).json({message: "Moderator ID is required"});
        }
        try{

            const articles = await Article.find({reviewer_id: moderatorId, status: { $nin: ['unassigned', 'published', 'discarded'] }});
            res.status(200).json(articles);
        }catch(err){
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

// publish article
module.exports.publishArticle = expressAsyncHandler(
    async (req, res)=>{
        const {articleId, reviewerId} = req.body;

        if(!articleId  || !reviewerId){
            return res.status(400).json({message: "Article ID and Reviewer ID are required"});
        }

        try{

            const [article, reviewer] = await Promise.all([
                Article.findById(Number(articleId)),
                admin.findById(reviewerId)
            ]);

            if(!article || !reviewer){
                return res.status(404).json({message: "Article or Reviewer not found"});
            }

            if(article.reviewer_id !== reviewerId){
                return res.status(403).json({message: "Article is not assigned to this reviewer"});
            }
            const user = await User.findById(article.authorId);
            if(!user){
                return res.status(404).json({message: "Author not found"});
            }
            article.status = "published";
            article.publishedDate = new Date();
            article.lastUpdated = new Date();

            await article.save();
            user.articles.push(article._id);

            await updateWriteEvents(article._id, user.id);
            await user.save();

            // send mail to user
           sendArticlePublishedEmail(user.email, "", article.title);

            // send notification
            articleReviewNotificationsToUser(user._id, article._id, {
                title: ` Your Article : ${article.title} is Live now!`,
                body: "Keep contributing!  We encourage you to keep sharing valuable content with us."
            });

            res.status(200).json({message: "Article Published"});

        }catch(err){
            console.error(err);
            res.status(500).json({ message: err.message });
        }
    }
)


// Update Write Event Tasks (Once article published)

async function updateWriteEvents(articleId, userId){

    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
  
    try {
  
      // Check for existing event entry
      const writeEvent = await WriteAggregate.findOne({userId: userId, date:today});
  
      if(!writeEvent){
         // New Write Event Entry
        const newWriteEvent = new WriteAggregate({ userId: userId, date:today });
        newWriteEvent.dailyWrites = 1;
        newWriteEvent.monthlyWrites = 1;
        newWriteEvent.yearlyWrites = 1;
        
        await newWriteEvent.save();
      }else{
  
        writeEvent.dailyWrites += 1;
        writeEvent.monthlyWrites += 1;
        writeEvent.yearlyWrites += 1;
        
        await writeEvent.save();
      }
    } catch (err) {
      console.log('Article Write Event Update Error', err);
    }
  }
// cron job for article unassigned

// cron job for article discarded

// article edit request section
// article and comment report section
// moderator contribution section
