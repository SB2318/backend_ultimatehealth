const express = require('express');
const router = express.Router();

const authenticateToken = require('../middleware/authentcatetoken');
const {
    getFollowingsPodcasts,
    getMyPlayLists,
    getPodcastsByPlaylistId,
    getPodcastById,
    getPodcastProfile,
    searchPodcast,

    createPodcast,
    savePodcast,
    likePodcast,
    updatePodcastViewCount
} = require('../controllers/podcastController');

router.get('/podcast/profile', authenticateToken, getPodcastProfile);
router.get('/podcast/followings', authenticateToken, getFollowingsPodcasts);
router.get('/podcast/get-my-playlists', authenticateToken, getMyPlayLists);
router.get('/podcast/playlist-details', authenticateToken, getPodcastsByPlaylistId);
router.get('/podcast/details', authenticateToken, getPodcastById);
router.get('/podcast/search', authenticateToken, searchPodcast);
router.post('/podcast/create', authenticateToken, createPodcast);
router.post('/podcast/like', authenticateToken, likePodcast);
router.post('/podcast/save', authenticateToken, savePodcast);
router.post('/podcast/update-view-count', authenticateToken, updatePodcastViewCount);

module.exports = router;