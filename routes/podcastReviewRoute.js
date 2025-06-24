const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authentcatetoken');

const {
    availablePodcastsForReview,
    getAllPodcastsOfModerator,
    getAllCompletedPodcastsOfModerator,
    pickPodcast,
    approvePodcast,
    discardPodcast
} = require('../controllers/admin/podcastReviewController');

router.get('/podcast-admin/available', authenticateToken, availablePodcastsForReview);
router.get('/podcast-admin/all', authenticateToken, getAllPodcastsOfModerator);
router.get('/podcast-admin/completed', authenticateToken, getAllCompletedPodcastsOfModerator);
router.post('/podcast-admin/pick', authenticateToken, pickPodcast);
router.post('/podcast-admin/approve', authenticateToken, approvePodcast);
router.post('/podcast-admin/discard', authenticateToken, discardPodcast);

module.exports = router;