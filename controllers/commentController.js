// Add Comment
// Edit Comment
// Delete Comment
// Reply to Comment
// Edit Reply
// Delete Reply
// getCommentsByArticleId

const expressAsyncHandler = require("express-async-handler");
const Article = require('../models/Articles');
const User = require('../models/UserModel');
const Comment = require('../models/commentSchema');

module.exports.addComment = expressAsyncHandler(

    async(req, res)=>{

        const {userId, articleId, parentCommentId, content} = req.body;

        if(!userId || !articleId || !content){
            return res.status(400).json({message: "Missing required fields."});
        }

        try{

            const [user, article] = await Promise.all([
                User.findById(userId),
                Article.findById(articleId)
            ]);

            if(!user || !article){
                return res.status(400).json({message:'User or Article not found'});
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
            if(parentCommentId){
                const parentComment = await Comment.findById(parentCommentId);

                if (!parentComment) {
                    return res.status(404).json({ message: 'Parent comment not found' });
                }
                parentComment.replies.push(newComment._id);
                await parentComment.save();
            }

            return res.status(200).json({message:"new comment added"});

        }catch(err){

            console.log('Comment addition error', err);
            return res.status(500).json({message:"Internal server error"});
        }   
    }
)

module.exports.editComment = expressAsyncHandler(
    async(req, res)=>{

        const {commentId, content} = req.body;

        if(!commentId || !content || content.trim() === ''){
            return res.status(400).json({message:'Invalid request : Comment ID and non-empty content are required.'});
        }

        try{

            const [comment, user] = await Promise.all(
                [
                   Comment.findById(commentId),
                   User.findById(req.user.userId)
                ]
            )

            if(!comment || !user){
                return res.status(404).json({message:'Comment or user not found'});
            }

            if(comment.userId !== user._id){
                return res.status(403).json({message:'You are not authorized to edit this comment'});
            }

            comment.content = content;
            comment.updatedAt = new Date();
            await comment.save();

            return res.status(200).json({message:"Comment updated"});
        }catch(err){

            console.log("Update Comment Error", err);
            return res.status(500).json({message:"Internal server error"});
        }
    }
)