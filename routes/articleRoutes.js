const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const authenticateToken = require('../middleware/authentcatetoken');

/**** For Article Tags */
router.post('/articles/tags', articleController.addNewTag);
router.get('/articles/tags', authenticateToken, articleController.getAllTags);
router.put('/articles/tags/:id', articleController.updateTagById);
router.delete('/articles/tags/:id', articleController.deleteArticleTagByIds);



/**** For Article *****/
router.post('/articles',authenticateToken, articleController.createArticle); // Create a new article
router.get('/articles',authenticateToken, articleController.getAllArticles);// Get all articles
router.get('/articles/:id',authenticateToken, articleController.getArticleById);// Get an article by ID
router.put('/articles/:id',authenticateToken, articleController.updateArticle);// Update an article by ID
router.delete('/articles/:id',authenticateToken, articleController.deleteArticle);// Delete an article by ID
router.post('/articles/saveArticle', authenticateToken, articleController.saveArticle); // Save Article
router.post('/articles/likeArticle', authenticateToken, articleController.likeArticle ); // For Like and Dislike
router.post('/articles/updateViewCount', authenticateToken, articleController.updateViewCount ); // For Like and Dislike
router.post('/article/readEvent', authenticateToken, articleController.updateReadEvents);
router.get('/article/read-status', authenticateToken, articleController.getReadDataForGraphs);
router.get('/article/write-status', authenticateToken, articleController.getWriteDataForGraphs );
router.post('/article/repost', authenticateToken, articleController.repostArticle);
router.get('/article/improvements', authenticateToken, articleController.getAllImprovementsForUser);
router.get('/user-articles',authenticateToken,articleController.getAllArticlesForUser);
router.get('/get-improvement/:reqid', authenticateToken, articleController.getImprovementById);


module.exports = router;
