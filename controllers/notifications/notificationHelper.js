
const admin = require('../../config/firebase');
const User = require('../../models/UserModel');
const Notification = require('../../models/notificationSchema');
const Admin = require('../../models/admin/adminModel');


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
const sendPushNotification = (deviceToken, message, data, id, role) => {
    // Ensure all values in data are strings
    const formattedData = {
        action: String(data.action),
        postId: String(data.data.postId),
        authorId: String(data.data.authorId),
    };

    const payload = {
        notification: {
            title: message.title,
            body: message.body,
        },
        data: formattedData,
    };

    // Send the push notification to a specific device token using send()
    admin.messaging()
        .send({
            token: deviceToken,  // This is the device token you're targeting
            notification: payload.notification,
            data: payload.data,
        })
        .then(async (response) => {
            console.log("Successfully sent message:", response);
            // Create Notification table, whenever a notification send, it will also store in our database
            const notification = new Notification({
                title: message.title,
                message: message.body,
                userId: id,
                role: Number(role)
            });

            console.log("Notification", notification);
            await notification.save();
        })
        .catch((error) => {
            console.log("Error sending message:", error);
        });
};


/**
 * 
 * @param {*} postId  // article id
 * @param {*} message // title: "@author posted", // body: "title of the article"
 * @param {*} authorId  // author id
 */
// Open NotificationScreen -> ArticleViewScreen
module.exports.sendPostNotification = async (postId, message, authorId) => {

    try {
        const user = await User.findById(authorId).populate('followers');

        if (user) {
            user.followers.forEach(u => {
                if (u.fcmToken) {
                    sendPushNotification(u.fcmToken, message, {
                        action: 'openPost',
                        data: {
                            postId: postId,
                            authorId: authorId
                        },
                        
                    }, u._id, 2);
                }
            });
        }
    } catch (err) {
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
module.exports.sendPostLikeNotification = async (authorId, message) => {
    try {
        const user = await User.findById(authorId);

       // console.log(user);
        if (user && user.fcmToken) {

            console.log("Push Notification sending");
            sendPushNotification(user.fcmToken, message, {
                action: 'likePost',
                data: {
                    postId: null,
                    authorId: null
                },
               
            }, user._id, 2)


        }
        else {
            console.log("No FCM token found");
        }
    } catch (err) {
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
module.exports.sendCommentNotification = async (authorId, postId, message, isAdmin = false) => {

    try {

        let user;
        let role = 0;

        if(isAdmin){

            user = await Admin.findById(authorId);
            role =1 ;
        }else{
            user = await User.findById(authorId);
            role = 2;
        }

        if (user && user.fcmToken) {
            sendPushNotification(user.fcmToken, message, {
                action: 'commentPost',
                data: {
                    postId: postId,
                    authorId: null,
                }
            }, user._id, role)
        }
    } catch (err) {
        console.error(err);
    }
}

/**
 * 
 * @param {*} userId  // comment author id
 * @param {*} postId  // article id
 * @param {*} message // title :"@username like your comment"
 */

module.exports.sendCommentLikeNotification = async (userId, postId, message) => {

    try {
        const user = await User.findById(userId);

        if (user && user.fcmToken) {

            sendPushNotification(user.fcmToken, message, {
                action: 'commentLikePost',
                data: {
                    postId: null,
                    authorId: null
                }
            }, user._id, 2)
        }
    } catch (err) {
        console.error(err);
        //sendPushNotification()
    }
}

/**
 * 
 * @param {*} userId -> user id, whom to be followed you
 * @param {*} message  -> title:"@username followed you since date.now"
 */
module.exports.userFollowNotification = async (userId, message) => {

    try {
        const user = await User.findById(userId);
        if (user && user.fcmToken) {
            sendPushNotification(user.fcmToken, message, {
                action: 'userFollow',
                data: {
                    postId: null,
                    authorId: null
                }
            }, user._id, 2);
        }
    } catch (err) {
        console.error(err);
    }
}

// Repost Notification

module.exports.repostNotification = async (userId, authorId, postId, message, authorMessage) => {

   try{

    // Notify to all followers
    const user = await User.findById(userId).populate('followers');

    if (user) {
        user.followers.forEach(u => {
            if (u.fcmToken) {
                sendPushNotification(u.fcmToken, message, {
                    action: 'notifyFollowersOnRepost',
                    data: {
                        postId: postId,
                        authorId: authorId
                    },
                    
                }, u._id, 2);
            }
        });
    }
    // Notify to author
    const author = await User.findById(authorId);

    if(author && author.fcmToken){
        sendPushNotification(author.fcmToken, authorMessage, {
            action: 'notifyAuthorOnRepost',
            data: {
                postId: postId,
                authorId: authorId
            },
            
        }, author._id, 2);
    }

   }catch(err){

    console.error(err);
   }
}

// Mention Notification

module.exports.mentionNotification = async (mentionedUsers, postId, message) =>{
    try{
        mentionedUsers.forEach( async userId => {

        const user = await User.findById(userId);

        if (user && user.fcmToken) {

            sendPushNotification(user.fcmToken, message, {
                action: 'commentMentionPost',
                data: {
                    postId: postId,
                    authorId: null
                }
            }, user._id, 2)
        }
            
        });
    }catch(err){
        console.error(err);

    }
}


module.exports.articleReviewNotificationsToUser = async (userId, postId, message, role) => {

    try {
        const user = await User.findById(userId);

        if (user && user.fcmToken) {

            sendPushNotification(user.fcmToken, message, {
                action: 'articleReview',
                data: {
                    postId: postId,
                    authorId: user._id
                }
            }, user._id, role)
        }
    } catch (err) {
        console.error(err);
        //sendPushNotification()
    }
}

