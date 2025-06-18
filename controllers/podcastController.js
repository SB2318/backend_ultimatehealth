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




module.exports = {
    getPodcastProfile,
    getFollowingsPodcasts,
    getMyPlayLists,
    getPodcastsByPlaylistId,
    getPodcastById,
    searchPodcast
}
