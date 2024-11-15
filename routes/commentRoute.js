const express = require("express");
const authenticateToken = require("../middleware/authentcatetoken");

const commentController = require('../controllers/commentController');
const router = express.Router();

router.post('/article/add-comment', authenticateToken, commentController.addComment);
router.put('/article/update-comment', authenticateToken, commentController.editComment);
router.delete('/article/delete-comment/:commentId', authenticateToken, commentController.deleteComment);

module.exports = router;