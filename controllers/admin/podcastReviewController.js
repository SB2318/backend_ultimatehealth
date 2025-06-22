const expressAsyncHandler = require('express-async-handler');
const Podcast = require('../../models/Podcast');
const admin = require('../../models/admin/adminModel');
const User = require('../../models/UserModel');
const AudioWAggregate = require("../../models/events/audioWriteEventSchema");
//const { sendArticleFeedbackEmail, sendArticlePublishedEmail, sendArticleDiscardEmail, sendMailArticleDiscardByAdmin } = require('../emailservice');
const cron = require('node-cron');
const statusEnum = require('../../utils/StatusEnum');
const AdminAggregate = require('../../models/events/adminContributionEvent');

// Available podcast review
const availablePodcastsForReview = expressAsyncHandler(
    async (req, res) => {
        try {
            const podcasts = await Podcast.find({
                status: statusEnum.statusEnum.REVIEW_PENDING
            });

            res.status(200).json(podcasts);
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Internal server error" });
        }
    }
)
// Get all podcast for moderator
const getAllPodcastsOfModerator = expressAsyncHandler(
    async (req, res) => {

        try {

            const podcasts = await Podcast.find({
                status: statusEnum.statusEnum.IN_PROGRESS,
                admin_id: req.userId
            });

            res.status(200).json(podcasts);

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Internal server error" });
        }
    }
)
// Get all completed podcasts for moderator
const getAllCompletedPodcastsOfModerator = expressAsyncHandler(

    async (req, res)=>{
          try {
            const podcasts = await Podcast.find({
                status: statusEnum.statusEnum.PUBLISHED,
                admin_id: req.userId
            });

            res.status(200).json(podcasts);

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Internal server error" });
        }
    }
)
// Pick Podcast
const pickPodcast = expressAsyncHandler(
    async (req, res)=>{

        try{
            const {podcast_id} = req.body;
            if(!podcast_id){
                return res.status(400).json({message: "Podcast id is required"})
            }
            const podcast = await Podcast.findById(podcast_id);
            const adminUser = await admin.findById(req.userId);

            if(!podcast || !adminUser){
                return res.status(404).json({message: "Podcast or admin not found"});
            }

            podcast.admin_id = req.userId;
            podcast.status = statusEnum.statusEnum.IN_PROGRESS;
            podcast.updated_at = new Date();

            await podcast.save();

            return res.status(200).json({message:"Podcast picked successfully"});

        }catch(err){
            console.log(err);
            res.status(500).json({message:"Internal server error"});
        }
    }
)
// Appprove podcast (Increase the count of admin contribution, increase the count of user contribution)
const approvePodcast = expressAsyncHandler(

    async (req, res)=>{
        try{
            const {podcast_id} = req.body;

            if(!podcast_id){
                return res.status(400).json({message: "Podcast id is required"});
            }

        }catch(err){
            console.log(err);
            return res.status(500).json({message: "Internal server error"});
        }
    }
)
// Discard podcast

module.exports = {
    availablePodcastsForReview,
    getAllPodcastsOfModerator,
    getAllCompletedPodcastsOfModerator,
    pickPodcast
}