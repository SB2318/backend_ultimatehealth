const express = require("express");
const authenticateToken = require("../middleware/authentcatetoken");
const controller = require("../controllers/reportController")
const router = express.Router();

router.post('/report/add-reason', authenticateToken, controller.addReason);
router.put('/report/update-reason', authenticateToken, controller.updateReason);
router.delete('/report/reason/:id', authenticateToken, controller.deleteReason);

router.get('/report/reasons', authenticateToken, controller.getAllReasons);

router.post('/report/submit', authenticateToken, controller.submitReport);
router.get('/report/pending-reports', authenticateToken, controller.getAllPendingReports);
router.get('/report/all-assigned-reports', authenticateToken, controller.getAllReportsForModerator);
router.get('/report-details/:id', authenticateToken, controller.getReportDetails);
router.post('/report/pick-report-for-investigation', authenticateToken, controller.pickReport);
router.post('/report/take-admin-action', authenticateToken, controller.takeAdminActionOnReport);
router.post('/report/convict-request-against-report', authenticateToken, controller.convictRequestToRestoreContent);
router.get('/report/all-reports-against-convict', authenticateToken, controller.getAllReportsAgainstConvict);

module.exports = router;