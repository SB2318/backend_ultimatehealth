const expressAsyncHandler = require("express-async-handler");
const ArticleTag = require("../models/ArticleModel");
const Article = require("../models/Articles");
const User = require("../models/UserModel");
const statusEnum = require("../utils/StatusEnum");
const Podcast = require("../models/Podcast");
const PlayList = require("../models/playlistSchema");
const AudioLikeAggregate = require('../models/events/audioLikeEventSchema');
const AudioViewAggregate = require('../models/events/audioViewEventSchema');

const mongoose = require('mongoose');

const getPodcastProfile = expressAsyncHandler(

    async (req, res) => {

        let userId = req.query.userId;
        try {
            if (!userId) {
                userId = req.userId;
            }
            const user = await User.findById(userId).populate('user_name Profile_image followers').lean().exec();

            if (!user) {
                return res.status(400).json({ message: "User not found" });
            }
            const allPodcasts = await Podcast.find({
                user_id: userId,
                status: statusEnum.statusEnum.PUBLISHED
            })
                .populate('tags')
                .sort({ updated_at: -1 });

            const allPlaylists = await PlayList.find({ user: userId })
                .populate({
                    path: 'podcasts',
                    match: { user_id: userId, status: statusEnum.statusEnum.PUBLISHED },
                    populate: {
                        path: 'tags',
                    }
                }).sort({
                    updated_at: -1
                });

            // filter all standalonepodcast and playlists
            const playListPodcastIds =
                allPlaylists.map((playlist) => playlist.podcasts.map(p => p._id.toString()));

            const standalonepodcast = allPodcasts.filter((podcast) => !playListPodcastIds.has(podcast._id.toString()));

            res.status(200).json({
                podcasts: standalonepodcast,
                playlists: allPlaylists,
                user: user
            });

        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

const getFollowingsPodcasts = expressAsyncHandler(
    async (req, res) => {

        try {

            const user = await User.findById(req.userId).lean();

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            if (!user.followings || user.followings.length === 0) {
                return res.status(200).json([]);
            }


            const podcasts = await Podcast.find({
                user_id: { $in: user.followings },
                status: statusEnum.statusEnum.PUBLISHED
            })
                .populate('tags')
                .populate('user_id', 'user_name Profile_image followers')
                .sort({
                    updated_at: -1
                })
                .lean()
                .exec();



            res.status(200).json(podcasts);

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

const getMyPlayLists = expressAsyncHandler(

    async (req, res) => {

        try {
            const playlists = await PlayList.find({ user: req.userId })
                .sort({
                    updated_at: -1
                });
            return res.status(200).json(playlists);
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }

);

const getPodcastsByPlaylistId = expressAsyncHandler(
    async (req, res) => {

        try {

            const { playlist_id } = req.query;

            if (!playlist_id) {
                return res.status(400).json({ message: 'Playlist id is required' });
            }

            const playlist = await PlayList.findById(playlist_id).populate({
                path: 'podcasts',
                populate: [
                    {
                        path: 'user_id',
                        select: 'user_name Profile_image followers'
                    },
                    {
                        path: 'tags'
                    }
                ]
            })
                .sort({
                    updated_at: -1
                })
                .lean().exec();

            if (!playlist) {
                return res.status(404).json({ message: 'Playlist not found' });
            }

            return res.status(200).json(playlist.podcasts);
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

const getPodcastById = expressAsyncHandler(
    async (req, res) => {

        try {
            const { podcast_id } = req.query;

            if (!podcast_id) {
                return res.status(400).json({ message: 'Podcast id is required' });
            }

            const podcast = await Podcast.findById(podcast_id).
                populate('user_id', 'user_name Profile_image followers').
                populate('tags').
                lean().
                exec();

            if (!podcast) {
                return res.status(404).json({ message: 'Podcast not found' });
            }
            return res.status(200).json(podcast);

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

const searchPodcast = expressAsyncHandler(
    async (req, res) => {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ message: 'Search query is required' })
        }
        try {
            const regex = new RegExp(q, 'i');
            // Find all article title matches with the rejex
            const matchingArticles = await Article.find({ title: regex }).select('_id title');
            const articleIds = matchingArticles.map(a => a._id);

            const matchPodcasts = await Podcast.
                find(
                    {
                        $or: [
                            { article_id: { $in: articleIds } },
                            { title: regex },
                            { description: regex }]
                    }
                )
                .select('_id title description article_id tags')
                .populate('tags')
                .populate('article_id', 'title')
                .sort({
                    updated_at: -1
                })
                .lean()
                .exec();


            return res.status(200).json(matchPodcasts);

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

const createPodcast = expressAsyncHandler(
    async (req, res) => {
        const { title, description, tags, article_id, audio_url, duration } = req.body;

        if (!title || !description || !tags || !article_id || !audio_url || !duration) {
            return res.status(400).json({ message: 'All fields are required: title, description, tags, article_id, audio_url, duration' });
        }

        try {

            const user = await User.findById(req.userId);

            if (user.isBlockUser || user.isBannedUser) {
                return res.status(403).json({ error: "User is blocked or banned." });
            }
            const podcast = new Podcast({
                title,
                description,
                tags,
                article_id,
                audio_url,
                duration
            });

            await podcast.save();
            res.status(201).json({ message: 'Podcast created successfully.', podcast: podcast });
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)

// Save Podcast : (published podcast)
const savePodcast = expressAsyncHandler(
    async (req, res) => {
        try {
            const { podcast_id } = req.body;

            if (!podcast_id) {
                return res.status(400).json({ message: "Podcast id required" });
            }
            const user = await User.findById(req.userId);
            const podcast = await Podcast.findById(podcast_id)
                .populate('tags') 
                .exec();

            if (!user || !podcast || podcast.is_removed) {
                return res.status(404).json({ error: 'User or podcast not found' });
            }

            if (user.isBannedUser) {
                return res.status(403).json({ error: 'User is banned' });
            }

            if (podcast.status !== statusEnum.statusEnum.PUBLISHED) {
                return res.status(400).json({ message: 'Podcast is not published' });
            }
        
            const savedUserSet = new Set(podcast.savedUsers.map((id)=> id.toString()));
            const isPodcastSaved = savedUserSet.has(req.userId);

            if (isPodcastSaved) {

                // unsave podcast
                await Podcast.findByIdAndUpdate(podcast_id, {
                        $pull: { savedUsers: user._id } 
                    });
                
                res.status(200).json({ message: 'Podcast unsaved' });
            }
            else {
            
                    Podcast.findByIdAndUpdate(podcast_id, {
                        $addToSet: { savedUsers: user._id } 
                    });
                
                res.status(200).json({ message: 'Podcast saved successfully' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Error saving podcast', details: error.message });
        }
    }
)

// Like Articles (published podcast)
const likePodcast = expressAsyncHandler(
    async (req, res) => {
        try {
            const { podcast_id } = req.body;
            if (!podcast_id) {
                return res.status(400).json({ message: "Podcast id required" });
            }

            const user = await User.findById(req.userId);
            const podcast = await Podcast.findById(podcast_id);

            if (!user || !podcast || podcast.is_removed) {
                return res.status(404).json({ error: 'User or Article not found' });
            }

            if (user.isBlockUser || user.isBannedUser) {
                return res.status(403).json({ error: 'User is blocked or banned' });
            }

            if (podcast.status !== statusEnum.statusEnum.PUBLISHED) {
                return res.status(400).json({ message: 'Article is not published' });
            }
            // Check if the article is already liked
            const likedUserSet = new Set(podcast.likedUsers.map(u => u.toString()));
            const isUserLiked = likedUserSet.has(req.userId);

            if (isUserLiked) {
                // Unlike It
                await Podcast.findByIdAndUpdate(podcast._id, {
                    $pull: { likedUsers: user._id } // Remove user from likedUsers
                });
              
                return res.status(200).json({
                    message: 'Podcast unliked successfully',
                    likeStatus: false
                });
            } else {

                await Podcast.findByIdAndUpdate(podcast._id, {
                    $addToSet: { likedUsers: user._id }
                });

                // Increase like contribution
                await updatePodcastLikeContribution(user._id);

                return res.status(200).json({
                    message: 'Podcast liked successfully',
                    likeStatus: true
                });
            }

        } catch (error) {
            res.status(500).json({ error: 'Error liking podcast', details: error.message });
        }
    }
)

// Update View Count (Published article)
const updatePodcastViewCount = expressAsyncHandler(
    async (req, res) => {
        const { podcast_id } = req.body;
        try {

            const user = await User.findById(req.userId);
            const podcast = await Podcast.findById(podcast_id);

            if (!user || !podcast || podcast.is_removed) {
                return res.status(404).json({ error: 'User or Article not found' });
            }

            if (user.isBlockUser || user.isBannedUser) {
                return res.status(403).json({ error: 'User is blocked or banned' });
            }

            if (podcast.status !== statusEnum.statusEnum.PUBLISHED) {
                return res.status(400).json({ message: 'Article is not published' });
            }
   
            const hasViewed = podcast.viewUsers.some(id => id.toString().equals(req.userId));
        
            if (hasViewed) {
                return res.status(200).json({ message: 'Podcast already viewed by user', data: podcast });
            }

            podcast.viewUsers.push(req.userId);

            await podcast.save();

            await updatePodcastViewContribution(req.userId);
            res.status(200).json({ message: 'Podcast view count updated', data: podcast });

        } catch (err) {
            res.status(500).json({ error: 'Error updating view', details: err.message });
        }
    }
)

async function updatePodcastLikeContribution(userId) {

    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));

    try {

        const event = await AudioLikeAggregate.findOne({ userId: userId, date: today });

        if (!event) {
            const newEvent = new AudioLikeAggregate({
                userId: userId,
                date: today,
                dailyLikes: 1,
                monthlyLikes: 1,
                yearlyLikes: 1
            });

            await newEvent.save();
        } else {

            event.dailyLikes += 1;
            event.monthlyLikes += 1;
            event.yearlyLikes += 1;
            await event.save();
        }
    } catch (err) {
        console.log(err);
    }

}

async function updatePodcastViewContribution(userId) {

    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));

    try {

        const user = await User.findById(userId);
        if(!user){
            return;
        }
        const event = await AudioViewAggregate.findOne({ userId: user._id, date: today });

        if (!event) {
            const newEvent = new AudioViewAggregate({
                userId: userId,
                date: today,
                dailyViews: 1,
                monthlyViews: 1,
                yearlyViews: 1
            });

            await newEvent.save();
        } else {
            event.dailyViews += 1;
            event.monthlyViews += 1;
            event.yearlyViews += 1;
            await event.save();
        }
    } catch (err) {
        console.log(err);
    }

}

// Get analytics

// GET ALL LIKE EVENTS STATUS DAILY, WEEKLY, MONTHLY
// TODO: LOCATION ANALYSIS
const getPodcastLikeDataForGraphs = expressAsyncHandler(
  async (req, res) => {

    const userId = req.userId;

    try {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const yearStart = new Date(today.getFullYear(), 0, 1);

      const dailyData = await AudioLikeAggregate.find({ userId, date: today });
      const monthlyData = await AudioLikeAggregate.find({ userId, date: { $gte: monthStart } });
      const yearlyData = await AudioLikeAggregate.find({ userId, date: { $gte: yearStart } });

      res.status(200).json({
        dailyLikes: {
          date: today.toISOString().slice(0, 10), 
          count: dailyData ? dailyData.dailyLikes : 0 
        },
        monthlyLikes: monthlyData.map(entry => ({
          date: entry.date.toISOString().slice(0, 10), 
          count: entry.monthlyLikes 
        })),
        yearlyLikes: yearlyData.map(entry => ({
          month: entry.date.toISOString().slice(0, 7), 
          count: entry.yearlyLikes 
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'An error occurred while fetching read data' });
    }
  }
)

// GET ALL VIEW EVENTS STATUS DAILY, WEEKLY, MONTHLY
// TODO: LOCATION ANALYSIS
// TODO: AVERAGE CALCULATION
const getPodcastViewDataForGraphs = expressAsyncHandler(
  async (req, res) => {

    const userId = req.userId;

    try {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const yearStart = new Date(today.getFullYear(), 0, 1);

      const dailyData = await AudioViewAggregate.find({ userId, date: today });
      const monthlyData = await AudioViewAggregate.find({ userId, date: { $gte: monthStart } });
      const yearlyData = await AudioViewAggregate.find({ userId, date: { $gte: yearStart } });

      res.status(200).json({
        dailyViews: {
          date: today.toISOString().slice(0, 10), 
          count: dailyData ? dailyData.dailyViews : 0 
        },
        monthlyViews: monthlyData.map(entry => ({
          date: entry.date.toISOString().slice(0, 10),
          count: entry.monthlyViews
        })),
        yearlyViews: yearlyData.map(entry => ({
          month: entry.date.toISOString().slice(0, 7), 
          count: entry.yearlyViews 
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'An error occurred while fetching read data' });
    }
  }
)


module.exports = {
    getPodcastProfile,
    getFollowingsPodcasts,
    getMyPlayLists,
    getPodcastsByPlaylistId,
    getPodcastById,
    searchPodcast,

    // post
    createPodcast,
    savePodcast,
    likePodcast,
    updatePodcastViewCount,
    getPodcastViewDataForGraphs,
    getPodcastLikeDataForGraphs
}
