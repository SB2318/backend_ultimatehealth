const express = require("express");
const authenticateToken = require("../middleware/authentcatetoken");
const controller = require("../controllers/reportController")
const router = express.Router();

router.post('/report/add-reason', authenticateToken, controller.addReason);
router.put('/report/update-reason', authenticateToken, controller.updateReason);
router.delete('/report/reason/:id', authenticateToken, controller.deleteReason);

router.get('/report/reasons', authenticateToken, controller.getAllReasons);

router.post('/report/submit', authenticateToken, controller.submitReport);
