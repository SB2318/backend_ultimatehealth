const mongoose = require('mongoose');
const {Schema} = require('mongoose');

const reviewSchema = new Schema({
    _id:{
        type: Schema.Types.ObjectId,
        auto: true,
        unique:true,  
    },
    article_id:{
        type: Number,
        required: true
    },
    admin_id:{
        type: Schema.Types.ObjectId,
        ref: 'admin', 
        default: null
    },
    review_status :{
        type: String,
        enum: ['pending', 'approved', 'rejected','awaiting-user'],
        default: 'pending'
    },
    comments:[
        {
            type: Schema.Types.ObjectId,
            ref: 'Comment',
            default: []
        }
    ],
    created_at:{
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("ReviewContent",reviewSchema);