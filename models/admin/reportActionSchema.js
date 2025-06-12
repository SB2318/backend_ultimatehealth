const mongoose = require('mongoose');
const {Schema} = require('mongoose');

const reportActionEnum = {
    PENDING:"Pending",                       
    RESOLVED: "Resolved",             
    DISMISSED: "Dismissed",           
    WARN_CONVICT: "User Warned",            
    REMOVE_CONTENT: "Content Removed",       
    EDIT_CONTENT: "Content Edited",         
    RESTORE_CONTENT: "Content Restored",      
    BLOCK_CONVICT: "User Blocked",  
    BAN_CONVICT: "User Banned",        
    ESCALATED: "Escalated",          
    INVESTIGATION: "Investigation Start",        
    IGNORE: "Ignored",
    CONVICT_REQUEST_TO_RESTORE_CONTENT: "CONVICT_REQUEST_TO_RESTORE_CONTENT",   
    CONVICT_REQUEST_DISAPPROVED : "CONVICT_REQUEST_DISAPPROVED",
};
const reportActionSchema = new Schema({

    
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
    convictId:{
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
    convict_statement:{
        type: String,
        default: null,
    }
   
})

const ReportAction = mongoose.model('ReportAction', reportActionSchema);

module.exports = {ReportAction, reportActionEnum};