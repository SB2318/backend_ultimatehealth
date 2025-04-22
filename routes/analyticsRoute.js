const express = require("express");
const authenticateToken = require("../middleware/authentcatetoken");
const controller = require("../controllers/analyticsController")
const router = express.Router();

router.get('/user-stats/:userId', authenticateToken, controller.getTotalLikeAndViewReceivedByUser);
router.get('/total-reads/:userId', authenticateToken, controller.getTotalReadCountOfUser);
router.get('/total-writes/:userId', authenticateToken,  controller.getTotalWriteCountOfUser);
router.get('/mostly-viewed/:userId', authenticateToken,  controller.getMostViewedArticles);

router.get('/daily-reads',authenticateToken, controller.getDailyReadDataForGraphs);
router.get('/monthly-reads', authenticateToken, controller.getMonthlyReadDataForGraphs);
router.get('/yearly-reads', authenticateToken, controller.getYearlyReadDataForGraphs);

router.get('/daily-writes',authenticateToken, controller.getDailyWriteDataForGraphs);
router.get('/monthly-writes', authenticateToken, controller.getMonthlyWriteDataForGraphs);
router.get('/yearly-writes', authenticateToken, controller.getYearlyWriteDataForGraphs);
router.get('/analytics/admin/get-yearly-contribution', authenticateToken, controller.getMonthlyBreakDownByYear);
router.get('/analytics/admin/get-monthly-contribution', authenticateToken, controller.getDailyBreakdownByMonth);

module.exports = router;