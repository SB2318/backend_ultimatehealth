const express = require("express");
const authenticateToken = require("../middleware/authentcatetoken");
const controller = require("../controllers/analyticsController")
const router = express.Router();

router.get('/user-stats/:userId', authenticateToken, controller.getTotalLikeAndViewReceivedByUser);
router.get('/total-reads/:userId', authenticateToken, controller.getTotalReadCountOfUser);
router.get('/total-writes/:userId', authenticateToken,  controller.getTotalWriteCountOfUser);
router.get('/mostly-viewed/:userId', authenticateToken,  controller.getMostViewedPostOfUser);

router.get('/daily-reads/:userId',authenticateToken, controller.getDailyReadDataForGraphs);
router.get('/monthly-reads/:userId', authenticateToken, controller.getMonthlyReadDataForGraphs);
router.get('/yearly-reads/:userId', authenticateToken, controller.getYearlyReadDataForGraphs);

router.get('/daily-writes/:userId',authenticateToken, controller.getDailyWriteDataForGraphs);
router.get('/monthly-writes/:userId', authenticateToken, controller.getMonthlyWriteDataForGraphs);
router.get('/yearly-writes/:userId', authenticateToken, controller.getYearlyWriteDataForGraphs);

module.exports = router;