const express = require('express');
const expressAsyncHandler = require('express-async-handler');

const compression = require('compression');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const Article = require('./models/Articles');
const User = require('./models/UserModel');
const Comment = require('./models/commentSchema');
const dotenv = require('dotenv');
const db = require("./config/database");
const userRoutes = require("./routes/usersRoutes");
const specializationRoutes = require("./routes/SpecializationsRoutes");
const articleRoutes = require("./routes/articleRoutes");
const analyticsRoute = require('./routes/analyticsRoute');
const uploadRoute = require('./routes/uploadRoute');

const app = express();
dotenv.config();
db.dbConnect();

const port = process.env.PORT | 8080;

app.use(express.static('public'));

app.use(cookieParser()); // Parse cookies
app.use(compression()); // Compress response bodies
app.use(express.json()); // Parse incoming JSON requests

// Define routes
app.use("/api", userRoutes);
app.use("/api", specializationRoutes);
app.use("/api", articleRoutes);
app.use("/api", uploadRoute);
app.use("/api/analytics", analyticsRoute);

// Test route (can be removed later)
app.get("/hello", (req, res) => {
    console.log("Hello World");
    res.send('Hello World');
});


const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})

let io = require('socket.io')(server);


/*** TRACK ONLINE USERS */

const onlineUsers = []
const addNewUser = ({username, socketId})=>{

    const existingUser = onlineUsers.find(user=>user.username === username);
    if(existingUser) return existingUser.socketId;
    const newUser = {id: crypto.randomUUID(), username, socketId};
    onlineUsers.push(newUser);
}

/** Remove User */

const removeUser = (socketId)=>{
    onlineUsers = onlineUsers.filter((user)=> user.socketId !== socketId);
}

/** Get User */
const getUser = (username)=>{
    return onlineUsers.find(user=>user.username === username);
}

io.on('connection', (socket) => {

    console.log('a user connected');

    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit("connect", "Some thing to show");
    });

    socket.on('new-user', (username)=>{
       addNewUser({username, socketId: socket.id});
    })

    socket.on('comment', expressAsyncHandler(
        async (data) => {

            socket.emit("comment-processing", true);

            console.log('Add Event called');
            const { userId, articleId, content, parentCommentId} = data;

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
                    .populate('replies'); 

                    socket.emit("comment-processing", false);
                    socket.emit('comment', {
                        parentCommentId: parentCommentId,
                        reply: populatedComment,
                        articleId: articleId
                    });

                } else {

                    const populatedComment = await Comment.findById(newComment._id)
                    .populate('userId', 'user_handle Profile_image')
                    .populate('replies'); 

                    socket.emit("comment-processing", false);
                    socket.emit('comment', {
                        comment: populatedComment,
                        articleId
                    });
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
                .populate('replies'); 

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
                const comment = await Comment.findById(commentId);

                if (!comment) {
                    socket.emit("delete-comment-processing", false);
                    socket.emit('error', { message: 'Comment not found' });
                    return;
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
                const comment = await Comment.findById(commentId).populate('likedUsers');

                if (!comment) {
                    socket.emit('error', { message: 'Comment not found' });
                    socket.emit("like-comment-processing", false);
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
                .populate('replies'); 

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
                    .populate('userId', 'user_handle Profile_image')
                    .populate('replies')
                    .sort({ createdAt: -1 }); // Sort by most recent first

                // Emit the comments and replies to the client
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

    socket.on('disconnect', () => {
        console.log('User disconnected');
        removeUser(socket.id);
    });

});



module.exports = app;