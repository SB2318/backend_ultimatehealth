const mongoose = require('mongoose');

const notifcationSchema = new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    role:{
      type : Number,
      required:true,
      default: 2 // 1-> admin or reviewr , 2-> User
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