const mongoose = require('mongoose');
const {Schema} = require('mongoose');

const reportActionEnum = {
    PENDING:"Pending",              // Report is awaiting review or action
    IN_PROGRESS: "In Progress",          // Report is being reviewed or under investigation
    RESOLVED: "Resolved",             // The report has been addressed or resolved
    DISMISSED: "Dismissed",            // Report was found to be invalid or unnecessary
    WARN_USER: "User Warned",            // The user who posted the content has been warned
    REMOVE_CONTENT: "Content Removed",       // The reported content has been removed or deleted
    EDIT_CONTENT: "Content Edited",         // The reported content has been edited for compliance
    RESTORE_CONTENT: "Content Restored",      // The previously removed content is reinstated
    BLOCK_USER: "User Blocked",           // The user has been temporarily or permanently blocked
    ESCALATED: "Escalated",            // The issue has been escalated to higher authorities or support
    INVESTIGATION: "Investigation",        // The report requires further investigation before any action
    IGNORE: "Ignored"                // The report was deemed not actionable and ignored
};
const reportActionSchema = new Schema({

    _id:{
        type: Schema.Types.ObjectId,
        required: true,
        unique: true,
    },
    admin_id:{
        type: Schema.Types.ObjectId,
        ref: 'admin', 
        default: null
    },
    action_taken:{
        type: String,
        required: true,
        enum: reportActionEnum,
        default: reportActionEnum.PENDING
    },

    articleId:{
        type: Number,
        required: true,
        ref:'Article'
    },
    commentId:{
       type: Schema.Types.ObjectId,
       default: null,
       ref:'Comment'
    },
    reportedBy:{
        type: Schema.Types.ObjectId,
        required: true,
        ref:'User'
    },
    reasonId:{
        type: Schema.Types.ObjectId,
        required: true,
        ref:'Reason'
    },
    last_action_date:{
      type: Date,
      default: Date.now
    },
    created_at:{
        type: Date,
        default: Date.now
    },
})

const ReportAction = mongoose.model('ReportAction', reportActionSchema);

module.exports = {ReportAction, reportActionEnum};