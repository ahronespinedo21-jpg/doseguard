const express = require('express');
const router = express.Router();
const medicationController = require('../controllers/medicationController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/', medicationController.createMedication);
router.get('/', medicationController.getMedications);
router.get('/low-stock', medicationController.getLowStock);
router.get('/:id', medicationController.getMedicationById);
router.put('/:id', medicationController.updateMedication);
router.delete('/:id', medicationController.deleteMedication);

module.exports = router;
