const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/log', reminderController.logReminder);
router.post('/sync', reminderController.syncOfflineLogs);
router.get('/logs', reminderController.getReminderLogs);
router.get('/adherence', reminderController.getAdherence);
router.get('/today', reminderController.getTodayReminders);

module.exports = router;
