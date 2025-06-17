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

const getMyPodcasts = expressAsyncHandler(

    async (req, res) => {

        try {
            const userId = req.userId;
            const podcast = await Podcast.find({ user_id: userId }).populate('tags').exec();
            res.status(200).json(podcast);
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
            const playlists = await PlayList.find({ user: req.userId });
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
            }).lean().exec();

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

            if(!podcast){
                return res.status(404).json({ message: 'Podcast not found' });
            }
            return res.status(200).json(podcast);

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
)


module.exports = {
    getMyPodcasts,
    getFollowingsPodcasts,
    getMyPlayLists,
    getPodcastsByPlaylistId,
    getPodcastById
}
