
const admin = require('../config/firebase');
const User = require('../models/UserModel');


/**
 * 
 * @param {
 * } deviceToken 
 * @param {*} message 
 */

/*
 Notification Cases:
  (I) POST Creation (Notify to all followers, with author_name) 
     Extra Data: (screen: article view page, article id)
  (II) Post Like (Only to author, with user_handle) (Extra Data: HomeScreen)
  (III) Post Comment (Only to Author , with comment message) (Extra Data: Comment Screen, article id)
  (IV) Comment Like (Only to Comment-Author, with post id) (Extra Data: Comment Screen, article id)
  (V) User Follow

  // Later 
  (I) POST Published
  (II) POST Updation
  (III) POST Deletion
  (IV) Comment Reply
  (V) Comment Mention
*/
module.exports.sendPushNotification = (deviceToken, message, data) => {

    const payload = {
        notification: {
            title: message.title,
            body: message.body,
        },
        data:{
            action: data.action,
            postId: data.data.postId,
            authorId: data.data.authorId,
        }
    };
   
    admin.messaging()
        .sendToDevice(deviceToken, payload)
        .then((response) => {
          console.log("Successfully sent message", response);
        })
        .catch((error)=>{
            console.log("Error sending message", error);
        })

}

/**
 * 
 * @param {*} postId  // article id
 * @param {*} message // title: "@author posted", // body: "title of the article"
 * @param {*} authorId  // author id
 */
// Open NotificationScreen -> ArticleViewScreen
module.exports.sendPostNotification = async (postId, message, authorId) => {

   try{
    const user = await User.findById(authorId).populate('followers');

    if(user){
       user.followers.forEach(u => {
           if (u.fcmToken) {  
             sendPushNotification(user.fcmToken, message, {
               action: 'openPost',
               data: {
                   postId: postId,
                   authorId: authorId
               },
             });
           }
         });
    }
   }catch(err){
    console.log(err);
   }
}

/**
 * 
 * @param {*} authorId  // author of the article
 * @param {*} message   // title & body:
 *                     // title: "@username like your post"
 */
// Open NotificationScreen -> HomeScreen
module.exports.sendPostLikeNotification = async (authorId, message) =>{
    try{
        const user = await User.findById(authorId);
    
    if(user && user.fcmToken){

        sendPushNotification(user.fcmToken, message, {
            action: 'likePost',
            data: {
                postId: null,
                authorId: null
            }
        })
    }
    }catch(err){
        console.log(err);
    }
}

// CommentScreen
/**
 * 
 * @param {*} authorId  // author of the article
 * @param {*} postId   // article id
 * @param {*} message  // title & body : title :"@username commented on your Post"
 *                      // body: "Your comment content here"
 */
module.exports.sendCommentNotification = async (authorId, postId, message) =>{

    try{

        const user = await User.findById(authorId);

        if(user && user.fcmToken){
            sendPushNotification(user.fcmToken, message, {
                action: 'commentPost',
                data:{
                    postId: postId,
                    authorId: null,
                }
            })
        }
    }catch(err){
        console.error(err);
    }
}

/**
 * 
 * @param {*} userId  // comment author id
 * @param {*} postId  // article id
 * @param {*} message // title :"@username like your comment"
 */

module.exports.sendCommentLikeNotification = async (userId, postId, message) =>{

     try{
        const user = await User.findById(userId);

        if(user && user.fcmToken){
   
            sendPushNotification(user.fcmToken, message, {
               action: 'commentLikePost',
               data: {
                postId: null,
                authorId: null
               }
            })
        }
     }catch(err){
        console.error(err);
        //sendPushNotification()
     }
}

/**
 * 
 * @param {*} userId -> user id, whom to be followed you
 * @param {*} message  -> title:"@username followed you since date.now"
 */
module.exports.userFollowNotification = async (userId,  message) =>{

    try{
        const user = await User.findById(userId);
        if(user && user.fcmToken){
            sendPushNotification(user.fcmToken, message, {      
                action: 'userFollow',
                data: {
                    postId: null,
                    authorId: null
                }
            })
        }
    }catch(err){
        console.error(err);
    }
}

