const http = require('http');
const socketIo = require('socket.io');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Initialize Firebase Admin SDK
const serviceAccount = require('./path-to-your-service-account-file.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const server = http.createServer();
const io = socketIo(server);

// Simulating a database of users and their device tokens
let users = [
  { userId: 1, deviceToken: 'token1' },
  { userId: 2, deviceToken: 'token2' },
  { userId: 3, deviceToken: 'token3' },
];

// Listen for socket events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Event: like clicked
  socket.on('likeClick', (data) => {
    sendLikeNotification(data);
  });

  // Event: comment posted
  socket.on('commentPosted', (data) => {
    sendCommentNotification(data);
  });

  // Event: comment clicked
  socket.on('commentClick', (data) => {
    sendCommentClickNotification(data);
  });

  // Event: post created (notify followers)
  socket.on('postCreated', (data) => {
    sendPostCreationNotification(data);
  });

  // Event: user mentioned
  socket.on('userMentioned', (data) => {
    sendMentionNotification(data);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Function to send a notification (generic function)
const sendPushNotification = (deviceToken, message, data) => {
  const payload = {
    notification: {
      title: message.title,
      body: message.body,
    },
    data: data,  // Include any additional data here, like screen to navigate
  };

  admin.messaging().sendToDevice(deviceToken, payload)
    .then(response => {
      console.log('Notification sent:', response);
    })
    .catch(error => {
      console.log('Error sending notification:', error);
    });
};

// Send notification when a post is liked
const sendLikeNotification = (data) => {
  const message = {
    title: 'Someone liked your post!',
    body: `${data.userName} liked your post.`,
  };

  const user = users.find(user => user.userId === data.postOwnerId);
  if (user) {
    sendPushNotification(user.deviceToken, message, {
      action: 'openPost',
      postId: data.postId,
    });
  }
};

// Send notification when a comment is posted
const sendCommentNotification = (data) => {
  const message = {
    title: 'New comment on your post!',
    body: `${data.userName} commented on your post.`,
  };

  const user = users.find(user => user.userId === data.postOwnerId);
  if (user) {
    sendPushNotification(user.deviceToken, message, {
      action: 'openPost',
      postId: data.postId,
    });
  }
};

// Send notification when a comment is clicked
const sendCommentClickNotification = (data) => {
  const message = {
    title: 'Comment opened!',
    body: `You clicked on a comment by ${data.userName}.`,
  };

  const user = users.find(user => user.userId === data.userId);
  if (user) {
    sendPushNotification(user.deviceToken, message, {
      action: 'openComment',
      commentId: data.commentId,
    });
  }
};

// Send notification when a post is created (notify followers)
const sendPostCreationNotification = (data) => {
  const message = {
    title: 'New post from a user you follow!',
    body: `${data.userName} has posted a new update.`,
  };

  users.forEach(user => {
    if (user.userId !== data.userId) {  // Don't notify the user who posted
      sendPushNotification(user.deviceToken, message, {
        action: 'openPost',
        postId: data.postId,
      });
    }
  });
};

// Send notification when a user is mentioned
const sendMentionNotification = (data) => {
  const message = {
    title: 'You were mentioned!',
    body: `${data.userName} mentioned you in a post or comment.`,
  };

  const user = users.find(user => user.userId === data.mentionedUserId);
  if (user) {
    sendPushNotification(user.deviceToken, message, {
      action: 'openMention',
      postId: data.postId,
      commentId: data.commentId,
    });
  }
};

// Start the server
server.listen(3000, () => {
  console.log('Server running on port 3000');
});


/*** */

import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import socketIOClient from 'socket.io-client';
import messaging from '@react-native-firebase/messaging';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const SOCKET_SERVER_URL = 'http://localhost:3000';  // Change to your server URL

const Stack = createStackNavigator();

const App = () => {
  useEffect(() => {
    // Connect to the socket server
    const socket = socketIOClient(SOCKET_SERVER_URL);

    // Handle push notifications when app is in the foreground
    messaging().onMessage(async remoteMessage => {
      console.log('Foreground message:', remoteMessage);
      handleNotification(remoteMessage.data);
    });

    // Handle notification click (when app is in the background or terminated)
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification opened from background:', remoteMessage);
      handleNotification(remoteMessage.data);
    });

    // Check if app was opened from a notification
    messaging().getInitialNotification().then(remoteMessage => {
      if (remoteMessage) {
        console.log('App opened from notification:', remoteMessage);
        handleNotification(remoteMessage.data);
      }
    });

    // Event listeners for socket events (e.g., like, comment, post creation)
    socket.on('likeClick', (data) => {
      console.log('Like event received', data);
      // Show local notification or update UI
    });

    socket.on('commentPosted', (data) => {
      console.log('Comment event received', data);
      // Show local notification or update UI
    });

    socket.on('commentClick', (data) => {
      console.log('Comment click event received', data);
      // Show local notification or update UI
    });

    socket.on('postCreated', (data) => {
      console.log('Post created event received', data);
      // Show local notification or update UI
    });

    socket.on('userMentioned', (data) => {
      console.log('User mentioned event received', data);
      // Show local notification or update UI
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleNotification = (data) => {
    if (data?.action === 'openPost') {
      // Navigate to the post screen
    } else if (data?.action === 'openComment') {
      // Navigate to the comment screen
    } else if (data?.action === 'openMention') {
      // Navigate to the mentioned post or comment
    }
  };

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="PostScreen" component={PostScreen} />
        <Stack.Screen name="CommentScreen" component={CommentScreen} />
        {/* More screens */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const HomeScreen = () => {
  return (
    <View>
      <Text>Welcome to the App</Text>
    </View>
  );
};

export default App;

import messaging from '@react-native-firebase/messaging';

// Subscribe user to a topic when they log in or initialize the app
const subscribeToTopics = async () => {
  // Example: subscribing user to the 'all_users' topic
  await messaging().subscribeToTopic('all_users');

  // Example: subscribing user to a personal topic (e.g., for post or comment notifications)
  await messaging().subscribeToTopic(`user_${userId}`);
};


/**** */

const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Initialize Firebase Admin SDK
const serviceAccount = require('./path-to-your-service-account-file.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const sendPostCreationNotificationToTopic = (post) => {
  const message = {
    notification: {
      title: 'New Post Created!',
      body: `${post.userName} created a new post.`,
    },
    topic: 'all_users',  // Send to the 'all_users' topic
    data: {
      action: 'openPost',
      postId: post.id,
    },
  };

  admin.messaging().send(message)
    .then(response => {
      console.log('Post creation notification sent to all users:', response);
    })
    .catch(error => {
      console.error('Error sending post creation notification:', error);
    });
};

// Call this function when a post is created
sendPostCreationNotificationToTopic(post);


/*** */

// When the app is initialized or user logs in:
const getDeviceToken = async () => {
    const token = await messaging().getToken();
    // Save the token to your database
    saveTokenToDatabase(userId, token);
  };
  
  const saveTokenToDatabase = async (userId, token) => {
    // Save the token in Firestore or a relational database
    // Example with Firestore
    const userRef = firestore.collection('users').doc(userId);
    await userRef.set({ fcmToken: token }, { merge: true });
  };

  
  /*** */

  const sendNotificationToAllUsers = (post) => {
    // Get all users' FCM tokens from the database
    firestore.collection('users').get()
      .then(snapshot => {
        const tokens = snapshot.docs.map(doc => doc.data().fcmToken);
        
        // Create the notification payload
        const message = {
          notification: {
            title: 'New Post Created!',
            body: `${post.userName} created a new post.`,
          },
          data: {
            action: 'openPost',
            postId: post.id,
          },
        };
  
        // Send to all tokens
        admin.messaging().sendToDevice(tokens, message)
          .then(response => {
            console.log('Notification sent to all users:', response);
          })
          .catch(error => {
            console.error('Error sending notification:', error);
          });
      })
      .catch(error => {
        console.error('Error fetching tokens from database:', error);
      });
  };
  
  // Call this function when a post is created
  sendNotificationToAllUsers(post);

  
  /** */
  