const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const AutoIncrement = require('mongoose-sequence')(mongoose);

const reasonSchema = new Schema({
    _id: {
        type: Number,
        autoIncrement: true,
    },
    reason: {
        type: String,
        required: true
    },
    status:{
        type: String,
        enum: ['Active','Archive'],
        default: 'Active',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt:{
        type: Date,
        default: Date.now,
    },

})

reasonSchema.plugin(AutoIncrement, { id: 'report_reason_id_counter', inc_field: '_id' });
const Reason = mongoose.model('Reason', reasonSchema);

const reportSchema = new Schema({

    _id: {
        type: Schema.Types.ObjectId,
        auto: true,
        unique: true
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
   
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt:{
        type: Date,
        default: Date.now,
    },
    status: {
        type: String,
        enum: ['Active', 'Resolved','Archive'],
        default: 'Active',
    },
  
});



const Report = mongoose.model('Report', reportSchema);

module.exports = { Report, Reason };

