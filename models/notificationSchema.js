const mongoose = require('mongoose');

const notifcationSchema = new mongoose.Schema({
    userID:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    read: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
})

module.exports = mongoose.model('Notification',  notifcationSchema);