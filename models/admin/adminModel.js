const mongoose = require('mongoose');
const {Schema} = require('mongoose');

const adminSchema = new Schema({
    _id:{
        type: Schema.Types.ObjectId,
        auto: true,
        unique:true,  
    },
    user_name: {
        type: String,
        required: true,
    },
    user_handle: {
        type: String,
        required: true,
        unique: true,
    },
     email: {
        type: String,
        required: true,
        unique: true,
        validate: {
          validator: validator.isEmail,
          message: '{VALUE} is not a valid email',
          isAsync: false,
        },
    },
    password: {
       type: String,
       required: true,
       minlength: [6, 'Password must be at least 6 characters long'],
    },
    role:{
        type:String,
        required:true,
        enum: ['Super Admin','Moderator']
    },
    created_at:{
        type:Date,
        default:Date.now

    },
    Profile_avtar: {
        type: String,
        default: "",
    },
    updated_at:{
        type:Date,
        default:Date.now
    },

    isVerified: {
        type: Boolean,
        default: false,
    },
    verificationToken: {
        type: String,
        default: null,
    },
    refreshToken: { type: String, default: null } ,
    fcmToken: { type: String, default: null }, 

});
module.exports = mongoose.model("admin",adminSchema);