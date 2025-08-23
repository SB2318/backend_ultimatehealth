const express = require("express");
const authenticateToken = require("../middleware/authentcatetoken");
const adminAuthenticateToken = require("../middleware/adminAuthenticateToken");
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
router.get('/admin/get-yearly-contribution', adminAuthenticateToken, controller.getMonthlyBreakDownByYear);
router.get('/admin/get-monthly-contribution', adminAuthenticateToken, controller.getDailyBreakdownByMonth);

module.exports = router;