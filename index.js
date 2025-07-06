const express = require('express');
const expressAsyncHandler = require('express-async-handler');

const compression = require('compression');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const articleReviewNotificationsToUser = require('./controllers/notifications/notificationHelper');
const sendArticleFeedbackEmail = require('./controllers/emailservice');
const EditRequest = require('./models/admin/articleEditRequestModel');
const Podcast = require('./models/Podcast');

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
const podcastRoute = require('./routes/podcastRoute');
const podcastAdminRoute = require('./routes/podcastReviewRoute');
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
app.use("/api", podcastRoute);
app.use("/api", podcastAdminRoute);

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

    socket.on("notification", (data) => {
        // get receiver info
        // const receiverInfo = getUser(receiver);
        // console.log(type, "received");
        if (data.type === 'openPost') {
            console.log('open post notification');
            sendPostNotification(data.postId, data.message, data.authorId,1);
        }
        else if (data.type === 'likePost') {
            console.log('like post notification');
            sendPostLikeNotification(data.authorId, data.message);
        }
        else if (data.type === 'commentPost') {
            console.log('comment post notification');
            sendCommentNotification(data.authorId, data.postId, data.message);
        }
        else if (data.type === 'commentLikePost') {
            console.log('comment like post notification');
            //sendCommentLikeNotification(data.userId, data.postId, data.message);
            sendCommentLikeNotification(data.userId, data.postId, data.message);
        }
        else if (data.type === 'userFollow') {
            console.log('user follow notification');
            sendUserFollowNotification(data.userId, data.message);
        }
        else if (data.type === "repost") {
            console.log("repost notification");
            repostNotification(data.userId, data.authorId, data.postId, data.message, data.authorMessage);
        }
        // io.to(receiverInfo.socketId).emit("notification", {sender, message, title});
    })
    socket.on('comment', expressAsyncHandler(
        async (data) => {

            socket.emit("comment-processing", true);

            // console.log('Add Event called');
            const { podcastId, userId, articleId, content, parentCommentId, mentionedUsers } = data;

            if (!userId || !content || content.trim() === '') {
                socket.emit("comment-processing", false);
                socket.emit('error', { message: "Missing required fields: userId, content" });
                return;
            }

            if (!podcastId && !articleId) {
                socket.emit("comment-processing", false);
                socket.emit('error', { message: "either podcast id or article id is required" });
                return;
            }

            try {
                let article, podcast;
                const user = await User.findById(userId);

                if (articleId) {
                    article = await Article.findById(articleId);
                }

                if (podcastId) {
                    podcast = await Podcast.findById(podcastId);
                }
                if (!user || (articleId && (!article || article.is_removed)) || (podcastId && (!podcast || podcast.is_removed))) {
                    socket.emit('error', { message: "user or article or podcast not found" });
                    socket.emit("comment-processing", false);
                    return;
                }

                if (user.isBlockUser || user.isBannedUser) {
                    socket.emit('error', { message: 'User is blocked or banned' });
                    return;
                }
                /** If a new user comment on the article, the id will automatically stored */

                let hasCommentedBefore;

                if (articleId) {
                    hasCommentedBefore = article.mentionedUsers.some(userid => userid.toString() === userId);
                    if (!hasCommentedBefore) {
                        article.mentionedUsers.push(userId);
                        await article.save();
                    }
                }
                else if (podcastId) {
                    hasCommentedBefore = podcast.mentionedUsers.some(userid => userid.toString() === userId);
                    if (!hasCommentedBefore) {
                        podcast.mentionedUsers.push(userId);
                        await podcast.save();
                    }
                }

                const newComment = new Comment({
                    userId,
                    articleId,
                    podcastId,
                    parentCommentId: parentCommentId || null,
                    content,
                    //username,
                    //userprofile
                });

                await newComment.save();

                // Now emit event

                if (parentCommentId) {
                    const parentComment = Comment.findById(parentCommentId);

                    if (!parentComment || parentComment.is_removed) {
                        socket.emit("comment-processing", false);
                        socket.emit('error', { message: 'Parent comment not found' });
                        return;
                    }
                    parentComment.replies.push(newComment._id);
                    await parentComment.save();

                    socket.emit('update-parent-comment', {
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
                        articleId: articleId,
                        podcastId: podcastId
                    });

                    if (articleId) {
                        sendCommentNotification(parentComment.userId, articleId, {
                            title: `${user.user_handle} replied to your comment`,
                            body: content
                        });
                    }
                    else if (podcastId) {
                        sendCommentNotification(parentComment.userId, podcastId, {
                            title: `${user.user_handle} replied to your comment`,
                            body: content
                        });
                    }

                } else {

                    const populatedComment = await Comment.findById(newComment._id)
                        .populate('userId', 'user_handle Profile_image')
                        .populate('replies')
                        .exec();

                    socket.emit("comment-processing", false);
                    socket.emit('comment', {
                        comment: populatedComment,
                        articleId,
                        podcastId
                    });

                    /** Send Mention Notification */
                    if (mentionedUsers && Array.isArray(mentionedUsers) && mentionedUsers.length > 0) {
                        mentionNotification(mentionedUsers, articleId, {
                            title: `${user.user_handle} mentioned you in a comment`,
                            body: content
                        });
                    }
                    //  console.log("Mentioned Users", mentionedUsers);

                    if (articleId) {
                        sendCommentNotification(userId, articleId, {
                            title: `${user.user_handle} commented on your post`,
                            body: content
                        });
                    } else if (podcastId) {
                        sendCommentNotification(userId, podcastId, {
                            title: `${user.user_handle} commented on your post`,
                            body: content
                        });
                    }
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
            const { podcastId, commentId, content, articleId, userId } = data;

            // console.log("Comment Id", commentId);
            //  console.log("Content", content);
            //  console.log("Article Id", articleId);
            //  console.log("User Id", userId);
            if (!commentId || !content || content.trim() === '' || !userId) {
                socket.emit("edit-comment-processing", false);
                socket.emit('error', { message: 'Invalid request: Comment ID, User Id and non-empty content are required.' });
                return;
            }

            if (!articleId && !podcastId) {
                socket.emit("edit-comment-processing", false);
                socket.emit('error', { message: 'Invalid request: either podcast id or article id required' });
                return;
            }

            try {

                let article, podcast;

                if (articleId) {
                    article = await Article.findById(articleId);
                }

                if (podcastId) {
                    podcast = await Podcast.findById(podcastId);
                }
                const [comment, user] = await Promise.all([
                    Comment.findById(commentId),
                    User.findById(userId),
                ]);

                if (!comment || !user ||
                    (articleId && (!article || article.is_removed))
                    || comment.is_removed
                    || (podcastId && (!podcast || podcast.is_removed))) {

                    socket.emit("edit-comment-processing", false);
                    socket.emit('error', { message: 'Comment or user or article or podcast not found' });
                    return;
                }

                if (user.isBlockUser || user.isBannedUser) {
                    socket.emit('error', { message: 'User is blocked or banned' });
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
            const { commentId, podcastId, articleId, userId } = data;

            if (!commentId || !userId) {
                socket.emit("delete-comment-processing", false);
                socket.emit('error', { message: 'Invalid request: Comment ID and user ID are required.' });
                return;
            }

            if (!podcastId && !articleId) {
                socket.emit("delete-comment-processing", false);
                socket.emit('error', { message: 'Invalid request: Podcast ID or article ID is required.' });
                return;
            }

            try {
                const [comment, user] = await Promise.all([
                    Comment.findById(commentId),
                    User.findById(userId)
                ]);

                if (!comment || !user || comment.is_removed) {
                    socket.emit("delete-comment-processing", false);
                    socket.emit('error', { message: 'Comment or user not found.' });
                    return;
                }

                if (user.isBlockUser || user.isBannedUser) {
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
                    if (parentComment || !parentComment.is_removed) {
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
                socket.emit('delete-comment', { commentId, articleId, podcastId });
            } catch (err) {
                console.error('Error deleting comment:', err);
                socket.emit("delete-comment-processing", false);
                socket.emit('error', { message: 'Error deleting comment' });
            }
        }
    ));

    socket.on('like-comment', expressAsyncHandler(
        async (data) => {
            const { commentId, articleId, podcastId, userId } = data;

            socket.emit("like-comment-processing", true);
            if (!commentId || !userId) {
                socket.emit('error', { message: "Invalid request: Comment ID and User ID are required." });
                socket.emit("like-comment-processing", false);
                return;
            }

            if (!articleId && !podcastId) {
                socket.emit('error', { message: "Invalid request: Article ID or Podcast ID is required ." });
                socket.emit("like-comment-processing", false);
                return;
            }

            try {

                let article, podcast;

                if (articleId) {
                    article = await Article.findById(articleId);
                }

                if (podcastId) {
                    podcast = await Podcast.findById(podcastId);
                }
                const [comment, user] = await Promise.all([
                    Comment.findById(commentId).populate('likedUsers').exec(),
                    User.findById(userId)
                ]);

                if (
                    !comment || !user ||
                    (articleId && (!article || article.is_removed))
                    || (podcastId && (!podcast || podcast.is_removed))
                    || comment.is_removed
                ) {
                    socket.emit('error', { message: 'Comment, article, podcast or user not found' });
                    socket.emit("like-comment-processing", false);
                    return;
                }

                if (user.isBlockUser || user.isBannedUser) {
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

                if (!hasLiked) {

                    if (articleId) {

                        sendCommentLikeNotification(populatedComment.userId, articleId, {
                            title: `${user.user_handle} liked your comment`,
                            body: `${article.title}`

                        });
                    } else if (podcastId) {
                        sendCommentLikeNotification(populatedComment.userId, podcastId, {
                            title: `${user.user_handle} liked your comment`,
                            body: `${podcast.title}`

                        });
                    }

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
            const { articleId, podcastId } = data;
            socket.emit("fetch-comment-processing", true);
            ///console.log("fetch comment called", articleId);

            if (!articleId && !podcastId) {
                socket.emit('error', { message: 'articleId or podcastId is required.' });
                socket.emit("fetch-comment-processing", false);
                return;
            }

            try {

                let article, podcast;

                if (articleId) {

                    article = await Article.findById(articleId);
                    if (!article || article.is_removed) {
                        socket.emit('error', { message: 'Article not found.' });
                        socket.emit("fetch-comment-processing", false);
                        return;
                    }
                }
                else if (podcastId) {
                    podcast = await Podcast.findById(podcastId);

                    if (!podcast || podcast.is_removed) {
                        socket.emit('error', { message: 'Podcast not found.' });
                        socket.emit("fetch-comment-processing", false);
                        return;
                    }
                }

                // Fetch all active comments related to the article
                let comments;
                if (articleId) {

                    comments = await Comment.find({ articleId: Number(articleId), status: 'Active', is_removed: false })
                        // .populate('userId', 'user_handle Profile_image')
                        .populate({
                            path: 'userId',
                            select: 'user_handle Profile_image',
                            match: {
                                isBlockUser: false,
                                isBannedUser: false
                            }
                        })
                        .populate('replies')
                        .sort({ createdAt: -1 })
                        .exec();
                }
                else if (podcastId) {

                    comments = await Comment.find({ podcastId: podcastId, status: 'Active', is_removed: false })
                        // .populate('userId', 'user_handle Profile_image')
                        .populate({
                            path: 'userId',
                            select: 'user_handle Profile_image',
                            match: {
                                isBlockUser: false,
                                isBannedUser: false
                            }
                        })
                        .populate('replies')
                        .sort({ createdAt: -1 })
                        .exec(); 
                }


              if(comments){
                comments = comments.filter(comment => comment.userId !== null);
                socket.emit("fetch-comment-processing", false);
                socket.emit('fetch-comments', {
                    articleId,
                    podcastId,
                    comments: comments
                });
              }

            } catch (err) {
                console.error('Error fetching comments:', err);
                socket.emit("fetch-comment-processing", false);
                socket.emit('error', { message: 'Error fetching comments.' });
            }
        }
    ));

    // add-review-comment (only article specific)
    socket.on('add-review-comment', expressAsyncHandler(

        async (data) => {
            const { articleId, reviewer_id, feedback, isReview, isNote, requestId } = data;

            if (!reviewer_id || !feedback) {
                socket.emit('error', { error: 'Please fill all fields: reviewer_id, reviewContent' });
                return;
            }
            if (!articleId && !requestId) {
                socket.emit('error', { error: 'Please provide either article id or improvement request id' });
                return;
            }

            if (!isReview && !isNote) {
                // res.status(400).json({ message: 'Please select either isReview or isNote'});
                socket.emit('error', { error: 'Please select a category: Review or Note' });
                return;
            }

            try {


                if (articleId) {
                    const [article, reviewer] = await Promise.all([

                        Article.findById(Number(articleId))
                            .populate('authorId')
                            .exec(),
                        admin.findById(reviewer_id),
                    ]);

                    if (!article || !reviewer || article.is_removed) {
                        socket.emit('error', { message: 'Article or Moderator not found' });
                        return;
                    }

                    if (article.reviewer_id !== reviewer._id) {
                        socket.emit('error', { message: 'You are not authorized to access this article' });
                    }

                    if (isReview) {
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

                    } else if (isNote) {

                        const comment = new Comment({
                            userId: article.authorId._id,
                            articleId: article._id,
                            parentCommentId: null,
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
                } else if (requestId) {

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

                    if (isReview) {
                        const comment = new Comment({
                            adminId: reviewer._id,
                            articleId: editRequest.article._id,
                            parentCommentId: null,
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

                    } else if (isNote) {

                        const comment = new Comment({
                            userId: editRequest.user_id._id,
                            articleId: editRequest.article._id,
                            parentCommentId: null,
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
                socket.emit('error', { message: err.message });
            }
        }

    ));
    // load-review-comments (only article specific)

    socket.on('load-review-comments', expressAsyncHandler(

        async (data) => {

            const { articleId, requestId } = data;

            if (!articleId && !requestId) {
                socket.emit('error', { message: "Either Article Id or improvement request id required" });
                return;
            }

            try {

                if (articleId) {
                    const article = await Article.findById(Number(articleId)).populate('review_comments').exec();
                    if (article && article.review_comments && !article.is_removed) {

                        article.review_comments = article.review_comments.filter(comment => !comment.is_removed);
                        socket.emit('review-comments', article.review_comments);
                    }
                    else {
                        socket.emit('error', { message: "Article not found" });
                    }
                } else if (requestId) {

                    const requests = await EditRequest.findById(requestId).populate('editComments').exec();
                    if (requests && requests.editComments) {
                        requests.editComments = requests.editComments.filter(comment => !comment.is_removed);
                        socket.emit('review-comments', requests.editComments);
                    }
                    else {
                        socket.emit('error', { message: "Improvement request not found" });
                    }
                }

            } catch (err) {
                console.log(err);
                socket.emit('error', { message: err.message });
            }
        }

    ));

    socket.on('disconnect', () => {
        console.log('User disconnected');
        // removeUser(socket.id);
    });

});

module.exports = app;