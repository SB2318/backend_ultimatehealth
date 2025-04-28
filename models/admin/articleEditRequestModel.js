const mongoose = require('mongoose');
const { Schema } = require('mongoose');

const editRequestSchema = new Schema(
    {
        _id: {
            type: Schema.Types.ObjectId,
            required: true,
            unique: true
        },
        user_id: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'User'
        },
        article: {
            type: Number,
            required: true,
            ref: 'Article'
        },
        edit_reason: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: ['unassigned', 'in-progress', 'review-pending', 'published', 'discarded', 'awaiting-user'],
            default: 'unassigned'
        },
        reviewer_id: {
            type: Schema.Types.ObjectId,
            ref: 'admin',
            default: null
        },
        edited_content: {
            type: String,
            default: null,
        },
        editComments: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Comment',
                default: []
            }
        ],
        created_at: {
            type: Date,
            default: Date.now
        },
        discardReason: {
            type: String,
            default: "Discarded by system"
        },
        last_updated:{
            type: Date,
            default: Date.now 
        }
    }
)


module.exports = mongoose.model("EditRequest", editRequestSchema);