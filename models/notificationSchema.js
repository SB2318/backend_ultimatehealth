const mongoose = require('mongoose');

const notifcationSchema = new mongoose.Schema({
    userID:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    title: String,
    message: String,
    read: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
})

module.exports = mongoose.model('Notification',  notifcationSchema);