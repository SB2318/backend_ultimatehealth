const express = require("express");
const { getAllArticleForReview, assignModerator, submitReview, submitSuggestedChanges, unassignModerator, publishArticle, getAllInProgressArticles, getAllReviewCompletedArticles, discardChanges } = require("../controllers/admin/articleReviewController");
const authenticateToken = require("../middleware/authentcatetoken");
const router = express.Router();


router.get('/admin/articles-for-review', authenticateToken, getAllArticleForReview);
router.get('/admin/review-progress/:reviewer_id', authenticateToken, getAllInProgressArticles);
router.get('/admin/review-completed', authenticateToken, getAllReviewCompletedArticles);
router.post('/admin/moderator-self-assign', authenticateToken, assignModerator);
router.post('/admin/submit-review', authenticateToken, submitReview);
router.post('/admin/submit-suggested-changes',authenticateToken, submitSuggestedChanges);
//router.get('/admin/moderator/:moderatorId/articles', getAllArticlesForAssignModerator);
router.post('/admin/publish-article', authenticateToken, publishArticle);
router.post('/admin/discard-changes', authenticateToken, discardChanges);
router.post('/admin/unassign-moderator', authenticateToken, unassignModerator);

module.exports = router;