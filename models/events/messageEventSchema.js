const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

MessageSchema.index({ userId: 1, date: 1 });
const MessageEvent = mongoose.model('MessageSchema', MessageSchema);
module.exports = MessageEvent