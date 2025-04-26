const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authentcatetoken');

const{
    submitEditRequest,
    getAllImprovementsForReview,
    getAllInProgressImprovementsForAdmin,
    getAllCompletedImprovementsForAdmin
}= require('../controllers/admin/articleEditRequestController');

router.post('/article/submit-edit-request', authenticateToken, submitEditRequest);
router.get('/admin/available-improvements', authenticateToken, getAllImprovementsForReview);
router.get('/admin/progress-improvements', authenticateToken, getAllInProgressImprovementsForAdmin);
router.get('/admin/publish-improvements', authenticateToken, getAllCompletedImprovementsForAdmin);

module.exports = router;