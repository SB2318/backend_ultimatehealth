const expressAsyncHandler = require("express-async-handler");
const ArticleTag = require("../models/ArticleModel");
const Article = require("../models/Articles");
const User = require("../models/UserModel");
const ReadAggregate = require("../models/events/readEventSchema");
const WriteAggregate = require("../models/events/writeEventSchema");
const statusEnum = require("../utils/StatusEnum");
const Podcast = require("../models/Podcast");
const PlayList = require("../models/playlistSchema");

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
            res.status(200).json({ message: 'Podcast view count updated', data: podcast });

        } catch (err) {
            res.status(500).json({ error: 'Error updating view', details: err.message });
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
    updatePodcastViewCount
}
