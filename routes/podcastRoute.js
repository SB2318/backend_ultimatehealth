const express = require('express');
const router = express.Router();

const authenticateToken = require('../middleware/authentcatetoken');
const {
    getMyPodcasts,
    getFollowingsPodcasts,
    getMyPlayLists,
    getPodcastsByPlaylistId,
    getPodcastById
} = require('../controllers/podcastController');

router.get('/podcast/me', authenticateToken, getMyPodcasts);
router.get('/podcast/followings', authenticateToken, getFollowingsPodcasts);
router.get('/podcast/get-my-playlists', authenticateToken, getMyPlayLists);
router.get('/podcast/playlist-details', authenticateToken, getPodcastsByPlaylistId);
router.get('/podcast/details', authenticateToken, getPodcastById);

module.exports = router;