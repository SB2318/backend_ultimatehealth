const express = require('express');
const expressAsyncHandler = require('express-async-handler');

const compression = require('compression');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const articleReviewNotificationsToUser = require('./controllers/notifications/notificationHelper');
const sendArticleFeedbackEmail = require('./controllers/emailservice');
const EditRequest = require('./models/admin/articleEditRequestModel');

const Article = require('./models/Articles');
const User = require('./models/UserModel');
const Comment = require('./models/commentSchema');
const admin = require('./models/admin/adminModel');
const dotenv = require('dotenv');
const db = require("./config/database");
const userRoutes = require("./routes/usersRoutes");
const specializationRoutes = require("./routes/SpecializationsRoutes");
const articleRoutes = require("./routes/articleRoutes");
const analyticsRoute = require('./routes/analyticsRoute');
const uploadRoute = require('./routes/uploadRoute');
const notificationRoute = require('./routes/notificationRoute');
const reportRoute = require('./routes/reportRoute');
const adminAuthRoute = require('./routes/adminAuthRoute');
const articleEditRoute = require('./routes/articleEditRequestRoute');
const adminRoute = require('./routes/adminRoute');
const { sendPostNotification, sendPostLikeNotification, sendCommentNotification, sendCommentLikeNotification, repostNotification, mentionNotification } = require('./controllers/notifications/notificationHelper');

const app = express();
dotenv.config();
db.dbConnect();

const port = process.env.PORT | 8080;

app.use(express.static('public'));

app.use(cookieParser()); // Parse cookies
app.use(compression()); // Compress response bodies
app.use(express.json()); // Parse incoming JSON requests
//app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true }))

// Define routes
app.use("/api", userRoutes);
app.use("/api", specializationRoutes);
app.use("/api", articleRoutes);
app.use("/api", uploadRoute);
app.use("/api/analytics", analyticsRoute);
app.use("/api", notificationRoute);
app.use("/api", reportRoute);
app.use("/api", adminAuthRoute);
app.use("/api", adminRoute);
app.use("/api", articleEditRoute);

// Test route (can be removed later)
app.get("/hello", (req, res) => {
    console.log("Hello World");
    res.send('Hello World');
});


const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})

let io = require('socket.io')(server);


/***  

// For Later Purpose
const onlineUsers = []
const addNewUser = ({userId, username, socketId})=>{

    const existingUser = onlineUsers.find(user=>user.userId === userId);
    if(existingUser) return existingUser.socketId;
    const newUser = {id: crypto.randomUUID(), userId: userId, username: username, socketId: socketId};
    onlineUsers.push(newUser);
}

/** Remove User 

const removeUser = (socketId)=>{
    onlineUsers = onlineUsers.filter((user)=> user.socketId !== socketId);
}

/** Get User 
const getUser = (userId)=>{
    return onlineUsers.find(user=>user.userId === userId);
}

*/

io.on('connection', (socket) => {

    console.log('a user connected');

    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit("connect", "Some thing to show");
    });

    /*
    socket.on('new-user', (username, userId)=>{
       addNewUser({userId, username, socketId: socket.id});
    })
       */

    socket.on("notification", (data)=>{
        // get receiver info
       // const receiverInfo = getUser(receiver);
      // console.log(type, "received");
        if(data.type === 'openPost'){
            console.log('open post notification');
            sendPostNotification(data.postId, data.message, data.authorId);
        }
        else if(data.type === 'likePost'){
            console.log('like post notification');
            sendPostLikeNotification(data.authorId, data.message);
        }
        else if(data.type === 'commentPost'){
            console.log('comment post notification');
            sendCommentNotification(data.authorId, data.postId, data.message);
        }
        else if(data.type === 'commentLikePost' ){
            console.log('comment like post notification');
            //sendCommentLikeNotification(data.userId, data.postId, data.message);
            sendCommentLikeNotification(data.userId, data.postId, data.message);
        }
        else if(data.type === 'userFollow'){
            console.log('user follow notification');
            sendUserFollowNotification(data.userId, data.message);
        }
        else if(data.type === "repost"){
            console.log("repost notification");
            repostNotification(data.userId, data.authorId, data.postId, data.message, data.authorMessage);
        }
       // io.to(receiverInfo.socketId).emit("notification", {sender, message, title});
    })
    socket.on('comment', expressAsyncHandler(
        async (data) => {

            socket.emit("comment-processing", true);

           // console.log('Add Event called');
            const { userId, articleId, content, parentCommentId, mentionedUsers} = data;

            if (!userId || !articleId || !content || content.trim() === '') {
                //socket.emit('error', 'Missing required fields');
                //console.log("User Id", userId);
                //console.log("Article Id", articleId);
                //console.log("Content", content);
                socket.emit("comment-processing", false);
                return;
            }

            try {

                const [user, article] = await Promise.all([
                    User.findById(userId),
                    Article.findById(Number(articleId))
                ]);

                if (!user || !article) {
                    socket.emit('error', 'User or article not found');
                    socket.emit("comment-processing", false);
                    return;
                }

                if(user.isBlockUser || user.isBannedUser){
                    socket.emit('error', {message: 'User is blocked or banned'});
                    return;
                }
                /** If a new user comment on the article, the id will automatically stored */
                const hasCommentedBefore = article.mentionedUsers.some(user => user._id.toString() === userId);

                if(!hasCommentedBefore){
                    article.mentionedUsers.push(userId);
                    await article.save();
                }

                const newComment = new Comment({
                    userId,
                    articleId,
                    parentCommentId: parentCommentId || null,
                    content,
                    //username,
                    //userprofile
                });

                await newComment.save();

                // Now emit event

                if (parentCommentId) {
                    const parentComment = Comment.findById(parentCommentId);

                    if (!parentComment) {
                        socket.emit("comment-processing", false);
                        socket.emit('error', { message: 'Parent comment not found' });
                        return;
                    }
                    parentComment.replies.push(newComment._id);
                    await parentComment.save();



                    socket.broacast.emit('update-parent-comment', {
                        parentCommentId: parentComment._id,
                        parentComment
                    });

                    // reply

                    const populatedComment = await Comment.findById(newComment._id)
                    .populate('userId', 'user_handle Profile_image')
                    .populate('replies')
                    .exec(); 

                    socket.emit("comment-processing", false);
                    socket.emit('comment', {
                        parentCommentId: parentCommentId,
                        reply: populatedComment,
                        articleId: articleId
                    });
                    sendCommentNotification(parentComment.userId, articleId, {
                        title: `${user.user_handle} replied to your comment`,
                        body: content
                    })

                } else {

                    const populatedComment = await Comment.findById(newComment._id)
                    .populate('userId', 'user_handle Profile_image')
                    .populate('replies')
                    .exec(); 

                    socket.emit("comment-processing", false);
                    socket.emit('comment', {
                        comment: populatedComment,
                        articleId
                    });

                    /** Send Mention Notification */
                    if(mentionedUsers && Array.isArray(mentionedUsers) && mentionedUsers.length > 0) {
                        mentionNotification(mentionedUsers, articleId, {
                            title: `${user.user_handle} mentioned you in a comment`,
                            body: content
                        });
                    }
                    console.log("Mentioned Users", mentionedUsers);
                    
                    sendCommentNotification(article.authorId, articleId, {
                        title: `${user.user_handle} commented on your post`,
                        body: content
                    })
                }

            } catch (err) {

                console.error('Error adding comment:', err);
                socket.emit('error', { message: 'Error adding comment' });
                socket.emit("comment-processing", false);
            }
        }
    ))

    socket.on('edit-comment', expressAsyncHandler(
        async (data) => {

            socket.emit("edit-comment-processing", true);
            const { commentId, content, articleId, userId } = data;

           // console.log("Comment Id", commentId);
          //  console.log("Content", content);
          //  console.log("Article Id", articleId);
          //  console.log("User Id", userId);
            if (!commentId || !content || !articleId || content.trim() === '' || !userId) {
                socket.emit("edit-comment-processing", false);
                socket.emit('error', { message: 'Invalid request: Comment ID, User Id and non-empty content are required.' });
                return;
            }

            try {
                const [comment, user, article] = await Promise.all([
                    Comment.findById(commentId),
                    User.findById(userId),
                    Article.findById(articleId)
                ]);

                if (!comment || !user || !article) {
                    socket.emit("edit-comment-processing", false);
                    socket.emit('error', { message: 'Comment or user or article not found' });
                    return;
                }

                if(user.isBlockUser || user.isBannedUser){
                    socket.emit('error', {message: 'User is blocked or banned'});
                    return;
                }


                if (comment.userId.toString() !== user._id.toString()) {
                    socket.emit("edit-comment-processing", false);
                    socket.emit('error', { message: 'You are not authorized to edit this comment' });
                    return;
                }

              
                comment.content = content;
                comment.updatedAt = new Date();
                comment.isEdited = true;
                await comment.save();
       
                const populatedComment = await Comment.findById(comment._id)
                .populate('userId', 'user_handle Profile_image')
                .populate('replies')
                .exec(); 

                socket.emit("edit-comment-processing", false);
                socket.emit('edit-comment', populatedComment); // Broadcast the edited comment
            } catch (err) {
                console.error("Error editing comment:", err);
                socket.emit("edit-comment-processing", false);
                socket.emit('error', { message: 'Error editing comment' });
            }

        }
    ));

    socket.on('delete-comment', expressAsyncHandler(
        async (data) => {

            socket.emit("delete-comment-processing", true);
            const { commentId, articleId, userId } = data;

            if (!commentId || !articleId || !userId) {
                socket.emit("delete-comment-processing", false);
                socket.emit('error', { message: 'Invalid request: Comment ID and article ID are required.' });
                return;
            }

            try {
                const [comment, user] = await Promise.all([
                    Comment.findById(commentId),
                    User.findById(userId)
                ]);

                if (!comment || !user) {
                    socket.emit("delete-comment-processing", false);
                    socket.emit('error', { message: 'Comment or user not found.' });
                    return;
                }

                if(user.isBlockUser || user.isBannedUser){
                    socket.emit("delete-comment-processing", false);
                    socket.emit('error', { message: 'You are blocked or banned.' });
                }

                // Check if the user is authorized to delete the comment
                if (comment.userId.toString() !== userId) {
                    socket.emit("delete-comment-processing", false);
                    socket.emit('error', { message: 'You are not authorized to delete this comment' });
                    return;
                }

                comment.status = 'Deleted';
                comment.updatedAt = new Date();
                await comment.save();

                // If it's a reply, update the parent comment
                if (comment.parentCommentId) {
                    const parentComment = await Comment.findById(comment.parentCommentId);
                    if (parentComment) {
                        parentComment.replies = parentComment.replies.filter(replyId => replyId.toString() !== commentId);
                        await parentComment.save();

                        socket.emit("delete-comment-processing", false);
                        socket.emit('delete-parent-comment', {
                            parentCommentId: comment.parentCommentId,
                            parentComment
                        });

                    }
                }
                socket.emit("delete-comment-processing", false);
                socket.emit('delete-comment', { commentId, articleId });
            } catch (err) {
                console.error('Error deleting comment:', err);
                socket.emit("delete-comment-processing", false);
                socket.emit('error', { message: 'Error deleting comment' });
            }
        }
    ));

    socket.on('like-comment', expressAsyncHandler(
        async (data) => {
            const { commentId, articleId, userId } = data;

            socket.emit("like-comment-processing", true);
            if (!commentId || !articleId || !userId) {
                socket.emit('error', { message: "Invalid request: Comment ID, Article ID, and User ID are required." });
                socket.emit("like-comment-processing", false);
                return;
            }

            try {
                const [comment, article, user] = await Promise.all([
                    Comment.findById(commentId).populate('likedUsers').exec(),
                    Article.findById(Number(articleId)),
                    User.findById(userId)
                ]);

                if (!comment || !article || !user) {
                    socket.emit('error', { message: 'Comment, article or user not found' });
                    socket.emit("like-comment-processing", false);
                    return;
                }

                if(user.isBlockUser || user.isBannedUser){
                    socket.emit('error', { message: 'You are blocked or banned' });
                    return;
                }

                const hasLiked = comment.likedUsers.some(like => like._id.toString() === userId);

                if (hasLiked) {
                    // Unlike the comment
                    await Comment.findByIdAndUpdate(commentId, {
                        $pull: { likedUsers: userId }
                    });

                } else {
                    // Like the comment
                    await Comment.findByIdAndUpdate(commentId, {
                        $addToSet: { likedUsers: userId }
                    });

                    
                  //  socket.emit('like-comment', { commentId, userId, articleId });
                }

                const populatedComment = await Comment.findById(commentId)
                .populate('userId', 'user_handle Profile_image')
                .populate('replies')
                .exec(); 

               if(!hasLiked){
                sendCommentLikeNotification(populatedComment.userId, articleId, {
                    title: `${user.user_handle} liked your comment`,
                    body: `${article.title}`
 
                 });
               }
                socket.emit("like-comment-processing", false);
                socket.emit('like-comment', populatedComment);
            } catch (err) {
                console.error('Error liking/unliking comment:', err);
                socket.emit("like-comment-processing", false);
                socket.emit('error', { message: 'Error processing like/unlike' });
            }
        }
    ));


    socket.on('fetch-comments', expressAsyncHandler(
        async (data) => {
            const { articleId } = data;
            socket.emit("fetch-comment-processing", true);
            console.log("fetch comment called", articleId);

            if (!articleId) {
                socket.emit('error', { message: 'articleId is required.' });
                socket.emit("fetch-comment-processing", false);
                return;
            }

            try {
                const article = await Article.findById(articleId);
                if (!article) {
                    socket.emit('error', { message: 'Article not found.' });
                    socket.emit("fetch-comment-processing", false);
                    return;
                }

                // Fetch all active comments related to the article
                const comments = await Comment.find({ articleId: articleId, status: 'Active' })
                   // .populate('userId', 'user_handle Profile_image')
                      .populate({
                        path: 'userId',
                        select: 'user_handle Profile_image',
                        match:{
                          isBlockUser: false,
                          isBannedUser: false
                        }
                       })
                       .populate('replies')
                       .sort({ createdAt: -1 })
                       .exec(); // Sort by most recent first

                // Emit the comments and replies to the client
                 comments = comments.filter(comment => comment.userId !== null);
                socket.emit("fetch-comment-processing", false);
                socket.emit('fetch-comments', {
                    articleId,
                    comments: comments
                });

            } catch (err) {
                console.error('Error fetching comments:', err);
                socket.emit("fetch-comment-processing", false);
                socket.emit('error', { message: 'Error fetching comments.' });
            }
        }
    ));

   // add-review-comment
   socket.on('add-review-comment', expressAsyncHandler(

     async (data) => {
            const { articleId, reviewer_id, feedback, isReview, isNote, requestId } = data;
    
            if (!reviewer_id || !feedback) {
                socket.emit('error',{ error: 'Please fill all fields: reviewer_id, reviewContent' });
                return;
            }
            if(!articleId && !requestId){
                socket.emit('error',{ error: 'Please provide either article id or improvement request id' });
                return;  
            }

            if(!isReview && !isNote){
                // res.status(400).json({ message: 'Please select either isReview or isNote'});
                socket.emit('error',{ error: 'Please select a category: Review or Note' });
                return;
            }
    
            try {
    

              if(articleId){
                const [article, reviewer] = await Promise.all([
    
                    Article.findById(Number(articleId))
                        .populate('authorId')
                        .exec(),
                    admin.findById(reviewer_id),
                ]);
    
                if (!article || !reviewer) {
                    socket.emit('error',{ message: 'Article or Moderator not found' });
                    return;
                }
    
                if (article.reviewer_id !== reviewer._id) {
                    socket.emit('error',{ message: 'You are not authorized to access this article' });
                }
    
               if(isReview){
                const comment = new Comment({
                    adminId: reviewer._id,
                    articleId: article._id,
                    parentCommentId: parentCommentId || null,
                    content: feedback,
                    isReview: true,
                    isNote: false
                });

                await comment.save();
                article.review_comments.push(comment._id);
    
                article.status = statusEnum.statusEnum.AWAITING_USER;
                article.lastUpdated = new Date();
    
                await article.save();

                socket.emit('new-feedback', comment);
                articleReviewNotificationsToUser(article.authorId._id, article._id, {
                    title: "New feedback received on your Article : " + article.title,
                    body: feedback
                }, 2);
                // send mail
                sendArticleFeedbackEmail(article.authorId.email, feedback, article.title);
    
               }else if(isNote){

                const comment = new Comment({
                    userId: article.authorId._id,
                    articleId: article._id,
                    parentCommentId:  null,
                    content: feedback,
                    isNote: true,
                    isReview: false
                });
                await comment.save();

                article.review_comments.push(comment._id);

                await article.save();

                socket.emit('new-feedback', comment);
                sendCommentNotification(article.reviewer_id, article._id, {
                    title: "New Additional Note from Author",
                    body: `An author has added a new note to the article titled ${article.title}.`
                });

                socket.emit('new-feedback', comment);
               }
              }else if(requestId){

                const [editRequest, reviewer] = await Promise.all([
    
                    EditRequest.findById(requestId)
                        .populate('article')
                        .populate('user_id')
                        .exec(),
                    admin.findById(reviewer_id),
                ]);
    
                if (!editRequest || !reviewer) {
                    socket.emit('error', { message: 'Request or Moderator not found' });
                    return;
                }
    
                if (editRequest.reviewer_id !== reviewer._id) {
                    socket.emit('error', { message: 'You are not authorized to access this article' });
                    return;
                }
    
               if(isReview){
                const comment = new Comment({
                    adminId: reviewer._id,
                    articleId: editRequest.article._id,
                    parentCommentId:  null,
                    content: feedback,
                    isReview: true,
                    isNote: false
                });

                await comment.save();
                editRequest.editComments.push(comment._id);
    
                editRequest.status = statusEnum.statusEnum.AWAITING_USER;
                editRequest.last_updated = new Date();
    
                await editRequest.save();

                socket.emit('new-feedback', comment);
                articleReviewNotificationsToUser(editRequest.user_id._id, editRequest.article._id, {
                    title: "New feedback received on your Article : " + editRequest.article.title,
                    body: feedback
                }, 2);
                // send mail
                sendArticleFeedbackEmail(editRequest.user_id.email, feedback, editRequest.article.title);
    
               }else if(isNote){

                const comment = new Comment({
                    userId: editRequest.user_id._id,
                    articleId: editRequest.article._id,
                    parentCommentId:  null,
                    content: feedback,
                    isNote: true,
                    isReview: false
                });
                await comment.save();

                editRequest.editComments.push(comment._id);

                await editRequest.save();

                socket.emit('new-feedback', comment);
                sendCommentNotification(editRequest.reviewer_id, editRequest.article._id, {
                    title: "New Additional Note from Author",
                    body: `An author has added a new note to the article titled ${editRequest.article.title}.`
                });

                socket.emit('new-feedback', comment);
               }
              }
               
            } catch (err) {
                console.log(err);
                socket.emit('error',{ message: err.message });
            }
        }

   ));
   // load-review-comments

   socket.on('load-review-comments', expressAsyncHandler(

    async(data) =>{

        const {articleId, requestId} = data;

        if(!articleId && !requestId){
            socket.emit('error',{message:"Either Article Id or improvement request id required"});
            return;
        }

        try{
           
            if(articleId){
                const article = await Article.findById(Number(articleId)).populate('review_comments').exec();
                if(article && article.review_comments){
                    socket.emit('review-comments', article.review_comments);
                }
                else{
                    socket.emit('error',{message:"Article not found"});
                }
            }else if(requestId){
               
                const requests = await EditRequest.findById(requestId).populate('editComments').exec();
                if(requests && requests.editComments){
                    socket.emit('review-comments', requests.editComments);
                }
                else{
                    socket.emit('error',{message:"Improvement request not found"});
                }
            }
            
        }catch(err){
            console.log(err);
            socket.emit('error',{ message: err.message });
        }
    }
     
   ));

   socket.on('disconnect', () => {
        console.log('User disconnected');
       // removeUser(socket.id);
   });

});

module.exports = app;