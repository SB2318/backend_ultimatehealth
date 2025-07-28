const expressAsyncHandler = require('express-async-handler');
const Podcast = require('../../models/Podcast');
const admin = require('../../models/admin/adminModel');
const AudioWAggregate = require("../../models/events/audioWriteEventSchema");
const cron = require('node-cron');
const statusEnum = require('../../utils/StatusEnum');
const AdminAggregate = require('../../models/events/adminContributionEvent');
const { sendPodcastPublishedEmail, sendPodcastDiscardEmail } = require('../emailservice');
const { sendPostNotification } = require('../notifications/notificationHelper');
const { deleteFileFn } = require('../uploadController');

// Available podcast review
const availablePodcastsForReview = expressAsyncHandler(
    async (req, res) => {
        try {
            const podcasts = await Podcast.find({
                status: statusEnum.statusEnum.REVIEW_PENDING
            }).populate('tags')
                .populate('user_id', 'user_name user_handle Profile_image')
                .sort({ updated_at: -1 });

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
            }).populate('tags')
                .populate('user_id', 'user_name user_handle Profile_image')
                .sort({ updated_at: -1 });

            res.status(200).json(podcasts);

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Internal server error" });
        }
    }
)
// Get all completed podcasts for moderator
const getAllCompletedPodcastsOfModerator = expressAsyncHandler(

    async (req, res) => {
        try {
            const podcasts = await Podcast.find({
                status: statusEnum.statusEnum.PUBLISHED,
                admin_id: req.userId
            }).populate('tags')
                .populate('user_id', 'user_name user_handle Profile_image')
                .sort({ updated_at: -1 });

            res.status(200).json(podcasts);

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Internal server error" });
        }
    }
)
// Pick Podcast
const pickPodcast = expressAsyncHandler(
    async (req, res) => {

        try {
            const { podcast_id } = req.body;
            if (!podcast_id) {
                return res.status(400).json({ message: "Podcast id is required" })
            }
            const podcast = await Podcast.findById(podcast_id);
            const adminUser = await admin.findById(req.userId);

            if (!podcast || !adminUser) {
                return res.status(404).json({ message: "Podcast or admin not found" });
            }
            if (podcast.admin_id !== null) {
                return res.status(400).json({ message: "Podcast is already picked by another admin." });
            }
            podcast.admin_id = adminUser._id;
            podcast.status = statusEnum.statusEnum.IN_PROGRESS;
            podcast.updated_at = new Date();

            await podcast.save();

            return res.status(200).json({ message: "Podcast picked successfully" });

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Internal server error" });
        }
    }
)
// Appprove podcast (Increase the count of admin contribution, increase the count of user contribution)
const approvePodcast = expressAsyncHandler(
    async (req, res) => {
        try {
            const { podcast_id } = req.body;

            if (!podcast_id) {
                return res.status(400).json({ message: "Podcast id is required" });
            }

            const podcast = await Podcast.findById(podcast_id).populate('user_id', 'name email').exec();
            const adminUser = await admin.findById(req.userId);

            if (!podcast || !adminUser) {
                return res.status(404).json({ message: "Podcast or admin not found" });
            }

            if (podcast.admin_id.toString() !== adminUser._id.toString()) {
                return res.status(400).json({ message: "You are not the admin of this podcast " });
            }

            podcast.status = statusEnum.statusEnum.PUBLISHED;
            podcast.updated_at = new Date();

            await podcast.save();

            // Increase admin contribution
            const adminAggregate = new AdminAggregate({
                userId: adminUser._id,
                contributionType: 4
            });
            await adminAggregate.save();

            // Increase user contribution
            await updateUserContribution(podcast.user_id._id);

            await sendPostNotification(podcast._id, {
                title: "Congratulations🎉! Your podcast has published",
                body: podcast.title,
            }, podcast.user_id._id, 2);

            // send mail
            sendPodcastPublishedEmail(podcast.user_id.email, "", podcast.title);
            return res.status(200).json({ message: "Podcast published successfully" });

        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
)


// Discard podcast

const discardPodcast = expressAsyncHandler(
    async (req, res) => {
        try {
            const { podcast_id, discardReason } = req.body;

            if (!podcast_id || !discardReason) {
                return res.status(400).json({ message: "Podcast id or discard-reason are required" });
            }

            const podcast = await Podcast.findById(podcast_id).populate('user_id', 'name email').exec();
            const adminUser = await admin.findById(req.userId);

            if (!podcast || !adminUser) {
                return res.status(404).json({ message: "Podcast or admin not found" });
            }

            if (podcast.admin_id.toString() !== adminUser._id.toString()) {
                return res.status(400).json({ message: "You are not the admin of this podcast " });
            }

            // delete audio url first
            podcast.status = statusEnum.statusEnum.DISCARDED;
            podcast.discardReason = discardReason;
            podcast.updated_at = new Date();

            // delete cover image
            const coverParts = podcast.cover_image.split('/api/getFile/');
            if (coverParts.length >= 2) {
                await deleteFileFn(coverParts[1]);
            }
            // delete audio file from aws
            const parts = podcast.audio_url.split('/api/getFile/');
            if (parts.length >= 2) {
                await deleteFileFn(parts[1]);
            }

            await podcast.save();

            // Increase admin contribution
            const adminAggregate = new AdminAggregate({
                userId: adminUser._id,
                contributionType: 4
            });
            await adminAggregate.save();

            // send mail

            await sendPostNotification(podcast._id, {
                title: "Podcast discarded",
                body: "Your podcast with title " + podcast.title + " has been discarded by admin",
            }, podcast.user_id._id, 2);

            sendPodcastDiscardEmail(podcast.user_id.email, podcast.status, podcast.title, discardReason);
            return res.status(200).json({ message: "Podcast discarded successfully" });

        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
)

async function updateUserContribution(userId) {

    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));

    try {

        const event = await AudioWAggregate.findOne({ userId: userId, date: today });

        if (!event) {
            const newEvent = new AudioWAggregate({
                userId: userId,
                date: today,
                monthlyUploads: 1,
                yearlyUploads: 1
            });

            await newEvent.save();
        } else {

            event.monthlyUploads += 1;
            event.yearlyUploads += 1;
            await event.save();
        }
    } catch (err) {
        console.log(err);
    }

}

// cron job for podcast  unassigned
async function unassignPodcast() {

    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const podcasts = await Podcast.find({
            status: {
                $in: [statusEnum.statusEnum.IN_PROGRESS]
            },
            lastUpdated: {
                $lte: thirtyDaysAgo
            },
            is_removed: false,
        });

        podcasts.forEach(async (podcast) => {

            podcast.admin_id = null;
            // article.assigned_at = null;
            podcast.status = statusEnum.statusEnum.UNASSIGNED;
            podcast.updated_at = new Date();

            await podcast.save();

            await sendPostNotification(podcast._id, {
                title: "Moderator Unassigned",
                body: "The moderator has unassigned themselves from your podcast titled \"" + podcast.title + "\".",
            }, podcast.user_id, 2);

        });

    } catch (err) {

        console.error(err);

    }
}

// discarded podcast will not be clickable

async function discardPodcastFn() {

    try {

        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const podcasts = await Podcast.find({
            status: {
                $in: [statusEnum.statusEnum.UNASSIGNED, statusEnum.statusEnum.REVIEW_PENDING]
            },
            lastUpdated: {

                $lte: sixtyDaysAgo

            },
            is_removed: false,
        }).populate('user_id').exec();

        podcasts.forEach(async (podcast) => {

            podcast.admin_id = null;
            // article.assigned_at = null;
            podcast.status = statusEnum.statusEnum.DISCARDED;

            const coverParts = podcast.cover_image.split('/api/getFile/');
            if (coverParts.length >= 2) {
                await deleteFileFn(coverParts[1]);
            }
            const parts = podcast.audio_url.split('/api/getFile/');
            if (parts.length >= 2) {
                await deleteFileFn(parts[1]);
            }

            await podcast.save();

            if (podcast.user_id?.email && podcast.title) {

                await sendPostNotification(podcast._id, {
                    title: "Podcast discarded",
                    body: "Your podcast with title " + podcast.title + " has been discarded by system",
                }, podcast.user_id._id, 2);
            }

        });
    } catch (err) {
        console.error(err);
    }
}



cron.schedule('0 0 * * *', async () => {


    await unassignPodcast();
});

cron.schedule('0 0 * * *', async () => {


    await discardPodcastFn();
});

module.exports = {
    availablePodcastsForReview,
    getAllPodcastsOfModerator,
    getAllCompletedPodcastsOfModerator,
    pickPodcast,
    approvePodcast,
    discardPodcast
}