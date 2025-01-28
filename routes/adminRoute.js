const express = require("express");
const { getAllArticleForReview, assignModerator, submitReview, submitSuggestedChanges, getAllArticlesForAssignModerator, publishArticle } = require("../controllers/admin/adminController");
const router = express.Router();

router.get('/admin/articles-for-review', getAllArticleForReview);
router.post('/admin/moderator-self-assign', assignModerator);
router.post('/admin/submit-review', submitReview);
router.post('/admin/submit-suggested-changes', submitSuggestedChanges);
router.get('/admin/moderator/:moderatorId/articles', getAllArticlesForAssignModerator);
router.post('/admin/publish-article', publishArticle);

module.exports = router;