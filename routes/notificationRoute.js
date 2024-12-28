const express = require('express');
const router = express.Router();

const authenticateToken = require('../middleware/authentcatetoken');

const notificationController = require('../controllers/notificationController');

router.post('/notification', authenticateToken, notificationController.createNotification);
router.get('/notifications', authenticateToken, notificationController.getAllNotifications);
router.get('/notification/unread-count', authenticateToken, notificationController.getUnreadNotificationCount);
router.put('/notifications/mark-as-read', authenticateToken, notificationController.markNotifications);


module.exports = router;

