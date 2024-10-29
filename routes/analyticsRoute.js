const express = require("express");
const authenticateToken = require("../middleware/authentcatetoken");
const controller = require("../controllers/analyticsController")
const router = express.Router();

router.get('/user-stats/:userId', authenticateToken, controller.getTotalLikeAndViewReceivedByUser);
router.get('/total-reads/:userId', authenticateToken, controller.getTotalReadCountOfUser);
router.get('/total-writes/:userId', authenticateToken,  controller.getTotalWriteCountOfUser);
router.get('/mostly-viewed/:userId', authenticateToken,  controller.getMostViewedPostOfUser);

module.exports = router;