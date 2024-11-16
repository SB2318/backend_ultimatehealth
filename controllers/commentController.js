
const expressAsyncHandler = require("express-async-handler");
const Article = require('../models/Articles');
const User = require('../models/UserModel');
const Comment = require('../models/commentSchema');

module.exports.addComment = expressAsyncHandler(

    async (req, res) => {

        const { userId, articleId, parentCommentId, content } = req.body;

        if (!userId || !articleId || !content) {
            return res.status(400).json({ message: "Missing required fields." });
        }

        try {

            const [user, article] = await Promise.all([
                User.findById(userId),
                Article.findById(articleId)
            ]);

            if (!user || !article) {
                return res.status(400).json({ message: 'User or Article not found' });
            }

            // add a new comment
            const newComment = new Comment({
                userId: userId,
                articleId: articleId,
                parentCommentId: parentCommentId || null,
                content: content
            })

            await newComment.save();

            // If it is a reply, add it to parent
            if (parentCommentId) {
                const parentComment = await Comment.findById(parentCommentId);

                if (!parentComment) {
                    return res.status(404).json({ message: 'Parent comment not found' });
                }
                parentComment.replies.push(newComment._id);
                await parentComment.save();

                // Emit the reply event to notify clients about the new reply

                req.app.io.emit('update-parent-comment', {
                    parentCommentId: newComment.parentCommentId,
                    parentComment: parentComment
                });

                req.app.io.emit('new-reply', {
                    parentCommentId: parentCommentId,
                    reply: newComment,
                    articleId: articleId
                });

                
            } else {

                req.app.io.emit('new-comment', {
                    comment: newComment,
                    articleId: articleId
                }); // emit new comment to all connected clients
            }


            return res.status(200).json({ message: "new comment added" });

        } catch (err) {

            console.log('Comment addition error', err);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
)


module.exports.editComment = expressAsyncHandler(
    async (req, res) => {

        const { commentId, content, articleId } = req.body;

        if (!commentId || !content || !articleId || content.trim() === '') {
            return res.status(400).json({ message: 'Invalid request : Comment ID and non-empty content are required.' });
        }

        try {

            const [comment, user, article] = await Promise.all(
                [
                    Comment.findById(commentId),
                    User.findById(req.user.userId),
                    Article.findById(Number(articleId))
                ]
            )

            if (!comment || !user || !article) {
                return res.status(404).json({ message: 'Comment or user or article not found' });
            }

            if (comment.userId.toString() !== user._id.toString()) {
                return res.status(403).json({ message: 'You are not authorized to edit this comment' });
            }

            comment.content = content;
            comment.updatedAt = new Date();
            comment.isEdited = true;
            await comment.save();

            req.app.io.emit('edit-comment', comment); // emit edited comment to all connected clients
            return res.status(200).json({ message: "Comment updated" });
        } catch (err) {

            console.log("Update Comment Error", err);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
)

// soft delete
module.exports.deleteComment = expressAsyncHandler(

    async (req, res) => {
        const { commentId, articleId } = req.params;

        if (!commentId || !articleId || commentId.trim() === '' || articleId.trim() === '') {
            return res.status(400).json({ message: 'Invalid request : Comment ID and article id is required.' });
        }

        try {

            const [comment, user, article] = await Promise.all([
                Comment.findById(commentId),
                User.findById(req.user.userId),
                Article.findById(Number(articleId))
            ]);

            if (!comment || !user || !article) {
                return res.status(404).json({ message: 'Comment or user or article not found' });
            }

            if (comment.userId.toString() !== user._id.toString()) {

                return res.status(403).json({ message: 'You are not authorised to delete this comment' });
            }

            comment.status = 'Deleted';
            comment.updatedAt = new Date();

            // If it is a reply, then remove it from it's parent
            if (comment.parentCommentId) {
                const parentComment = await Comment.findById(comment.parentCommentId);
                if (parentComment) {
                    // Remove the comment from the parent's replies list
                    parentComment.replies = parentComment.replies.filter(
                        (replyId) => replyId.toString() !== commentId
                    );
                    await parentComment.save();

                    // Emit the updated parent comment with the new replies array
                    req.app.io.emit('update-parent-comment', {
                        parentCommentId: comment.parentCommentId,
                        parentComment: parentComment
                    });
                }
            }

            await comment.save();

            req.app.io.emit('delete-comment', {
                commentId: commentId,
                articleId: comment.articleId,
                isReply: comment.parentCommentId? true: false
            });

            return res.status(200).json({ message: 'Comment as deleted' });

        } catch (err) {

            console.log('Error deleting comment:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
)

// like or unlike comment
module.exports.likeComment = expressAsyncHandler(

    async (req, res) => {
        try {
            const { commentid, articleId } = req.body;

            if (!commentid || !articleId) {
                return res.status(400).json({ message: "Comment id is required" });
            }

            const[user, article, comment] = await Promise.all([
                User.findById(req.user.userId),
                Article.findById(Number(articleId)),
                Comment.findById(commentid)
                .populate('likedUsers')
                .exec()
            ])
   
   

            if (!user || !comment || !article) {
                return res.status(404).json({ error: 'User or comment or article not found' });
            }


            // Check if the article is already liked
            const likedCommentsSet = new Set(comment.likedUsers);
            const isCommentLiked = likedCommentsSet.has(req.user.userId);

            if (isCommentLiked) {

                // Unlike It
                await Promise.all([
                    Comment.findByIdAndUpdate(commentid, {
                        $pull: { likedUsers: req.user.userId } // Remove user from likedUsers
                    }),
                ]);

                req.app.io.emit('unlike-comment', {
                    commentId: commentid,
                    userId: req.user.userId,
                    articleId: comment.articleId,
                    newLikeCount: comment.likedUsers.length - 1 
                });
                return res.status(200).json({ message: 'Comment unliked successfully' });

            } else {
                await Promise.all([
                    Comment.findByIdAndUpdate(commentid, {
                        $addToSet: { likedUsers: req.user.userId } // Add user to likedUsers
                    }),
                ]);

                req.app.io.emit('like-comment', {
                    commentId: commentid,
                    userId: req.user.userId,
                    articleId: comment.articleId,
                    newLikeCount: comment.likedUsers.length - 1 
                });

                return res.status(200).json({ message: 'Comment liked successfully' });
            }

        } catch (error) {
            res.status(500).json({ error: 'Error liking article', details: error.message });
        }
    }
)

// get all comments
module.exports.getAllCommentsForArticles = expressAsyncHandler(

    async (req, res) => {

        try {

            const { articleid } = req.params;

            if (!articleid) {
                return res.status(404).json({ error: 'Article id required' });
            }

            const article = await Article.findById(Number(articleid));
            // Later with try to found comments from article

            if(!article){
                return res.status(404).json({ error: 'Article not found' });
            }

            const comments = await Comment.find({ articleId: articleid, status: 'Active' })
                .populate('userId', 'user_handle Profile_image')
                .populate('replies')
                .sort([
                    ['userId', req.user.userId ? 1 : -1],
                    ['createdAt', -1]
                ])

                req.app.io.emit('comments-loaded', {
                    articleId: articleid,
                    comments: comments
                });

            res.status(200).json(comments);

        } catch (err) {

            console.log('GET ALL COMMENTS ERROR', err);
            res.status(500).json({ error: 'Error fetching comments', details: err.message });
        }
    }
)
