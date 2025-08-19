const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
       // ref: 'User', 
        required: true
    },
    role: {
        type: Number,
        required: true,
        default: 2 // 1 -> admin/reviewer, 2 -> user
    },
    type: {
        type: String,
        required: true,
        enum: [
            'articleReview',
            'mention',
            'repost',
            'userFollow',
            'commentLike',
            'comment',
            'post',
            'postLike'
        ]
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    data: {
        articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
        podcastId: { type: mongoose.Schema.Types.ObjectId, ref: 'Podcast' },
        authorId: { type: mongoose.Schema.Types.ObjectId, default: null },
        recordId: { type: String, required: true },
        // 1-> article, 2->podcast, 3-> comment, 4-> improvement
        postType: { type: Number, default: 1 }, 
        mentionedUsers: [{ type: mongoose.Schema.Types.ObjectId, default: null }],
        commentId: { type: mongoose.Schema.Types.ObjectId, default: null },
        senderId: { type: mongoose.Schema.Types.ObjectId, default: null },
        senderRole: { type: Number },
        receiverId: { type: mongoose.Schema.Types.ObjectId, default: null },
        receiverRole: { type: Number },
        userHandle: { type: String }
    },
    read: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Notification', notificationSchema);
