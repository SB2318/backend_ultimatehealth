const expressAsyncHandler = require("express-async-handler");
const MessageEvent = require("../models/events/messageEventSchema");
const User = require("../models/userSchema");

// Fetch User Contacts

// Author-Editor Communication, USER-TO-USER COMMUNICATION

const getUserContacts = expressAsyncHandler(
    async (req, res) => {
       
        const userId = req.user.userId;

        try{

            const messages =  await MessageEvent.find({ 
                $or:{
                    senderId: userId,
                    receiverId: userId
                }
            });

            // Use a Map to track unique contact IDs
          
           let contactMap = new Map();

           messages.forEach((message)=>{

            // Collect other contacts, rather than user
            const contactId = message.senderId.toString() === userId.toString() ? message.receiverId : message.senderId;
            
            if(!contactMap.has(contactId) || contactMap.get(contactId).createdAt < message.createdAt){

                contactMap.set(contactId, {
                    lastMessage: message.content,
                    createdAt: message.createdAt,
                });
            }

           })

        const contacts = await User.find({ _id: { $in: Array.from(contactMap.keys()) } });

           // All contact details with last message
        const contactDetails = contacts.map(contact => ({
            id: contact._id,
            username: contact.user_handle,
            profileImage: contact.Profile_image,
            lastMessage: contactMap.get(contact._id.toString()).lastMessage,
            lastMessageDate: contactMap.get(contact._id.toString()).createdAt,
        }));

        res.status(200).json(contactDetails)

        }catch(err){
           console.log('Get Contact Errors', err);
           res.status(500).json({message: "Internal server error"})
        }
    }
)

// Get Conversations

// Add Message

// DELETE MESSAGE

// POST COMMENT FOR ARTICLE
// EDIT COMMENT
// DELETE COMMENT
// GET COMMENTS FOR ARTICLE

// REPLY TO A COMMENT
// LIKE- UNLIKE COMMENT


