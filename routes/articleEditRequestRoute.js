const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authentcatetoken');

const{
    submitEditRequest,
    getAllImprovementsForReview,
    getAllInProgressImprovementsForAdmin,
    getAllCompletedImprovementsForAdmin,
    pickImprovementRequest,
    submitReviewOnImprovement,
    submitImprovement,
    detectContentLoss, 
    discardImprovement
}= require('../controllers/admin/articleEditRequestController');

router.post('/article/submit-edit-request', authenticateToken, submitEditRequest);
router.get('/admin/available-improvements', authenticateToken, getAllImprovementsForReview);
router.get('/admin/progress-improvements', authenticateToken, getAllInProgressImprovementsForAdmin);
router.get('/admin/publish-improvements', authenticateToken, getAllCompletedImprovementsForAdmin);
router.post('/article/approve-improvement-request', authenticateToken, pickImprovementRequest);
router.post('/article/submit-review-on-improvement', authenticateToken, submitReviewOnImprovement);
router.post('/article/submit-improvement', authenticateToken, submitImprovement);
router.post('/article/detect-content-loss', authenticateToken, detectContentLoss);
router.post('/article/discard-improvement', authenticateToken, discardImprovement);


module.exports = router;