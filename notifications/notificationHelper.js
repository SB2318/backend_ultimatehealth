
import admin from "../config/firebase";


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

  // Later 
  (I) POST Published
  (II) POST Updation
  (III) POST Deletion
  (IV) Comment Reply
  (V) Comment Mention
*/
const sendPushNotification = (deviceToken, message) => {

    const payload = {
        notification: {
            title: message.title,
            body: message.body,
        },
        data:{
            action:"click_action",
            screen: message.screen,
            extraData: "",
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

export default sendPushNotification;