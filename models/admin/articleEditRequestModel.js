const mongoose = require('mongoose');
const {Schema} = require('mongoose');

const editRequestSchema = new Schema(
    {
        _id:{
            type: Schema.Types.ObjectId,
            required: true,
            unique: true
        },
        user_id:{
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'User'
        },
        article_id:{
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'Article'
        },
        edit_reason:{
            type: String,
            required: true
        },
        status:{
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        admin_id:{
            type: Schema.Types.ObjectId,
            ref: 'admin', 
            default: null
        },
        created_at:{
            type: Date,
            default: Date.now
        }
    }
)


module.exports = mongoose.model("EditRequest",editRequestSchema);