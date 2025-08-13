const express = require('express');
const router = express.Router();

const authenticateToken = require('../middleware/authentcatetoken');
const {
    getFollowingsPodcasts,
    getMyPlayLists,
    getPodcastsByPlaylistId,
    getPodcastById,
    getPodcastProfile,
    getAllPublishedPodcasts,
    searchPodcast,

    createPodcast,
    savePodcast,
    likePodcast,
    updatePodcastViewCount,

    getPodcastLikeDataForGraphs,
    getPodcastViewDataForGraphs,

    addPodcastToPlaylist,
    createPlaylist,
    removePodcastFromPlaylist,

    // Update
    updatePlaylist,
    updatePodcast,

    // Delete
    deletePodcast,
    deletePlaylist,
    filterPodcast,
    updatePlaylistwithPodcast,
    getUserPendingPodcasts,
    getUserPublishedPodcasts,
    getDiscardedPodcasts
} = require('../controllers/podcastController');

router.get('/podcast/profile', authenticateToken, getPodcastProfile);
router.get('/podcast/followings', authenticateToken, getFollowingsPodcasts);
router.get('/podcast/get-my-playlists', authenticateToken, getMyPlayLists);
router.get('/podcast/playlist-details', authenticateToken, getPodcastsByPlaylistId);
router.get('/podcast/published-podcasts', authenticateToken, getAllPublishedPodcasts);
router.get('/podcast/details', authenticateToken, getPodcastById);
router.get('/podcast/search', authenticateToken, searchPodcast);
router.post('/podcast/filter', authenticateToken, filterPodcast);
router.get('/podcast/view-graph', authenticateToken, getPodcastViewDataForGraphs);
router.get('/podcast/like-graph', authenticateToken, getPodcastLikeDataForGraphs);
router.post('/podcast/create', authenticateToken, createPodcast);
router.post('/podcast/like', authenticateToken, likePodcast);
router.post('/podcast/save', authenticateToken, savePodcast);
router.post('/podcast/update-view-count', authenticateToken, updatePodcastViewCount);

router.post('/podcast/create-playlist', authenticateToken, createPlaylist);
router.post('/podcast/add-podcast-form-playlist', authenticateToken, addPodcastToPlaylist);
router.post('/podcast/remove-podcast-to-playlist', authenticateToken, removePodcastFromPlaylist);
router.post('/podcast/update-playlist', authenticateToken, updatePlaylistwithPodcast);

router.put('/podcast/update', authenticateToken, updatePodcast);
router.put('/podcast/update-playlist', authenticateToken, updatePlaylist);

router.delete('/podcast/delete', authenticateToken, deletePodcast);
router.delete('/podcast/delete-playlist', authenticateToken, deletePlaylist);

// workspace

router.get('/podcast/discarded', authenticateToken, getDiscardedPodcasts);
router.get('/podcast/user-pending', authenticateToken, getUserPendingPodcasts);
router.get('/podcast/user-published', authenticateToken, getUserPublishedPodcasts);


module.exports = router;