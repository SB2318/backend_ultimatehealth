const mongoose = require('mongoose');
const {Schema} = require('mongoose');

const reportActionEnum = [
    "Pending",              // Report is awaiting review or action
    "In Progress",          // Report is being reviewed or under investigation
    "Resolved",             // The report has been addressed or resolved
    "Dismissed",            // Report was found to be invalid or unnecessary
    "Ban User",             // The user who posted the content has been banned
    "Warn User",            // The user who posted the content has been warned
    "Remove Content",       // The reported content has been removed or deleted
    "Edit Content",         // The reported content has been edited for compliance
    "Restore Content",      // The previously removed content is reinstated
    "Block User",           // The user has been temporarily or permanently blocked
    "Escalated",            // The issue has been escalated to higher authorities or support
    "Investigation",        // The report requires further investigation before any action
    "Ignore"                // The report was deemed not actionable and ignored
  ];
const reportActionSchema = new Schema({

    _id:{
        type: Schema.Types.ObjectId,
        required: true,
        unique: true,
    },

    report_id:{
        type: Schema.Types.ObjectId,
        required: true,
        ref:"Report"
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
        default: "Pending"
    },
    last_action_date:{
      type: Date,
      default: Date.now
    },
    created_at:{
        type: Date,
        default: Date.now
    }
})

const ReportAction = mongoose.model('ReportAction', reportActionSchema);

module.exports = ReportAction;