const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', adminController.getUserDetails);
router.get('/users/:userId/medications', adminController.getUserMedications);
router.get('/users/:userId/adherence', adminController.getUserAdherence);
router.get('/users/:userId/reminder-logs', adminController.getUserReminderLogs);
router.delete('/users/:userId', adminController.deleteUser);

router.get('/medications', adminController.getAllMedications);
router.delete('/medications/:medicationId', adminController.deleteMedication);
router.get('/reminder-logs', adminController.getAllReminderLogs);
router.get('/stats/system', adminController.getSystemStats);

module.exports = router;
