const mongoose = require('mongoose');
const expressAsyncHandler = require("express-async-handler");
const cron = require('node-cron');

// CREATE NOTIFICATION
const Notification = require('../../models/notificationSchema');
const User = require('../../models/UserModel');

module.exports.createNotification = expressAsyncHandler(
    async(req, res)=>{
        const {title, message, userId} = req.body;

        if(!title || !message || !userId){
           res.status(400).json({message:"Insufficient field"});
           return;
        }

        try{
         
            const notification = new Notification({
                title:title,
                message:message,
                userId:userId,
            });

            await notification.save();
                  
           res.status(200).json({message:"Notification created"});

        }catch(err){
            console.log(err);
            res.status(500).json({message:err.message});
        }
    }
)
// GET ALL NOTIFICATIONS BY USER ID

module.exports.getAllNotifications = expressAsyncHandler(

    async(req, res)=>{

        const userId = req.user.userId;
        console.log("User Id", userId);

        if(!userId){
            res.status(400).json({message:"User ID is required"});
            return;
        }

        try{

            const notifications = await Notification.find({userId:userId}).sort({timestamp:-1});
            res.status(200).json(notifications);

        }catch(err){
            console.log(err);
            res.status(500).json({message:"Internal server error"});
        }
    }
)
// MARK ALL NOTICATIONS AS READ FOR USER
module.exports.markNotifications = expressAsyncHandler(
    async (req, res) => {

         const userId = req.user.userId;

         if(!userId){
            res.status(400).json({message:"User ID is required"});
            return;
         }

         try{

            await Notification.updateMany(
                { userId: userId },  
                { $set: { read: true } }  
            );
            res.status(200).json({message:"Notifications marked as read"});

         }catch(err){
            console.log(err);
            res.status(500).json({message:"Internal server error"});
         }
    }
)
// GET UNREAD NOTIFICATION COUNT FOR AN USER
module.exports.getUnreadNotificationCount = expressAsyncHandler(

    async (req, res)=>{
        const userId = req.user.userId;

        if(!userId){
            res.status(400).json({message:"User ID is required"});
            return;
        }

        try{

            const unreadCount = await Notification.countDocuments({userId:userId,read:false});
            res.status(200).json({unreadCount});
        }catch(err){
            console.log(err);
            res.status(500).json({message:"Internal server error"});
        }
    }
)

// DELETE NOTIFICATION BY ID
module.exports.deleteNotificationById = expressAsyncHandler(

    async (req, res)=>{
        const notificationId = req.params.id;
        const userId = req.user.userId;
        if(!notificationId || !userId){
           res.status(400).json({message:"Notification id or User id are required"});
           return;
        }

        try{
            const notification= await Notification.findById(notificationId);

           
            if(!notification){
                res.status(404).json({message:"Notification not found"});
                return;
            }
            if(!notification.userId.equals(new mongoose.Types.ObjectId(userId))){
               res.status(403).json({message:" Request forbidden"});
               return;
            }

            await Notification.deleteOne({ _id: notification._id });
            res.status(200).json({message:"Notification deleted"});

        }catch(err){
            console.log(err);
            res.status(500).json({message:"Internal server error"});
        }
    }
)

// DELETE OLD NOTIFICATIONS -> CRON JOB
const deleteOldNotifications = async()=>{

    console.log("Running cron job to deleteing old notifications");
    try{

         const onedayago = new Date();
         onedayago.setDate(date.getDate()-1);

          await Notification.deleteMany({
            read: true,  // Only delete read notifications
            timestamp: { $lt: onedayago }  // Only delete those older than 1 day
         });

    }catch(err){
        console.log(err);
    }
}

cron.schedule('0 0 * * *',deleteOldNotifications)