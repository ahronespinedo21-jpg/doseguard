const Medication = require('../models/Medication');
const ReminderLog = require('../models/ReminderLog');
const { Op } = require('sequelize');

exports.createMedication = async (req, res) => {
  try {
    console.log('🔍 createMedication received body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 User ID:', req.user?.id);
    console.log('🔍 User object:', req.user);

    if (!req.user || !req.user.id) {
      console.error('❌ No user or user ID found in request');
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No user found'
      });
    }

    const { name, dosage, dosageType, frequency, timeSchedule, amount, category, startDate, endDate, stockLevel, notes, isPillboxConnected } = req.body;

    const sanitizeHtml = (str) => {
      if (typeof str !== 'string') return '';
      return str.replace(/<[^>]*>/g, '').trim();
    };

    const cleanName = sanitizeHtml(name);
    const cleanDosage = sanitizeHtml(dosage);
    const cleanCategory = sanitizeHtml(category) || 'General';
    const cleanNotes = sanitizeHtml(notes);

    console.log('🔍 Parsed fields (sanitized):');
    console.log('  name:', cleanName);
    console.log('  dosage:', cleanDosage);
    console.log('  timeSchedule:', timeSchedule, 'type:', typeof timeSchedule, 'isArray:', Array.isArray(timeSchedule));
    console.log('  amount:', amount);
    console.log('  category:', cleanCategory);
    console.log('  frequency:', frequency);
    console.log('  startDate:', startDate);

    if (!cleanName || !cleanDosage || !frequency || !startDate) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, dosage, frequency, startDate'
      });
    }

    // Check for duplicate medication name for this user
    const existingMedication = await Medication.findOne({
      where: {
        userId: req.user.id,
        name: cleanName
      }
    });

    if (existingMedication) {
      console.warn('⚠️ Duplicate medication found:', cleanName);
      return res.status(409).json({
        success: false,
        message: `Medication '${cleanName}' already exists. Please use a different name or update the existing medication.`
      });
    }

    // Validate and clean timeSchedule - filter out empty strings
    let cleanedTimeSchedule = [];
    if (Array.isArray(timeSchedule)) {
      cleanedTimeSchedule = timeSchedule.filter(t => t && typeof t === 'string' && t.trim() !== '');
    }

    if (cleanedTimeSchedule.length === 0) {
      console.warn('⚠️ No valid timeSchedule provided, using default');
      cleanedTimeSchedule = ['08:00'];
    }

    console.log('✅ Validated timeSchedule:', cleanedTimeSchedule);

    const medicationData = {
      userId: req.user.id,
      name: cleanName,
      dosage: cleanDosage,
      dosageType: dosageType || 'specific',
      frequency,
      timeSchedule: cleanedTimeSchedule,
      amount: amount || 0,
      category: cleanCategory,
      startDate,
      endDate,
      stockLevel: stockLevel || 0,
      notes: cleanNotes,
      isPillboxConnected: isPillboxConnected || false,
      isActive: true
    };

    console.log('📝 Creating medication with data:', JSON.stringify(medicationData, null, 2));

    const medication = await Medication.create(medicationData);

    console.log('✅ Medication created successfully:', {
      id: medication.id,
      name: medication.name,
      timeSchedule: medication.timeSchedule,
      amount: medication.amount
    });

    // 🔔 AUTOMATICALLY CREATE REMINDER LOGS FOR TODAY AND FUTURE DATES
    console.log('🔔 Creating reminder logs for medication:', medication.name);

    // Use UTC dates for consistency
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    console.log('   Today (UTC):', today.toISOString());

    try {
      // Create reminders for today and next 7 days
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const reminderDate = new Date(today);
        reminderDate.setDate(reminderDate.getDate() + dayOffset);

        // Create a reminder entry for each scheduled time
        for (const time of cleanedTimeSchedule) {
          console.log(`   Creating reminder for time: ${time} on ${reminderDate.toISOString()}`);

          // Check if reminder already exists for this date and time
          const existingReminder = await ReminderLog.findOne({
            where: {
              userId: req.user.id,
              medicationId: medication.id,
              scheduledTime: time,
              date: reminderDate
            }
          });

          if (!existingReminder) {
            const newReminder = await ReminderLog.create({
              userId: req.user.id,
              medicationId: medication.id,
              scheduledTime: time,
              date: reminderDate,
              status: 'pending',
              notes: `Auto-created reminder for ${name}`
            });
            console.log(`  ✓ Created reminder ID: ${newReminder.id} for ${time} on ${reminderDate.toDateString()}`);
          } else {
            console.log(`  ⏭️ Skipped (already exists): ${time} on ${reminderDate.toDateString()}`);
          }
        }
      }
      console.log('✅ All reminders created successfully');
    } catch (reminderError) {
      console.error('⚠️ Warning: Failed to create reminders, but medication was created:', reminderError);
      console.error(reminderError.stack);
      // Don't fail the medication creation if reminders fail
    }

    return res.status(201).json({
      success: true,
      message: 'Medication created successfully',
      medication
    });
  } catch (error) {
    console.error('❌ Error in createMedication:', error);
    console.error('Error name:', error.name);
    console.error('Error stack:', error.stack);

    // Check for specific database errors
    if (error.name === 'SequelizeValidationError') {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => e.message)
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      console.error('Unique constraint error:', error.errors);
      return res.status(409).json({
        success: false,
        message: 'This medication already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create medication',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.getMedications = async (req, res) => {
  try {
    const medications = await Medication.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      count: medications.length,
      medications
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch medications'
    });
  }
};

exports.getMedicationById = async (req, res) => {
  try {
    const { id } = req.params;

    const medication = await Medication.findOne({
      where: { id, userId: req.user.id }
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    return res.status(200).json({
      success: true,
      medication
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch medication'
    });
  }
};

exports.updateMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const medication = await Medication.findOne({
      where: { id, userId: req.user.id }
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    const sanitizeHtml = (str) => {
      if (typeof str !== 'string') return '';
      return str.replace(/<[^>]*>/g, '').trim();
    };

    Object.keys(updates).forEach(key => {
      if (key !== 'userId' && key !== 'id' && key !== 'createdAt') {
        if (['name', 'dosage', 'category', 'notes'].includes(key) && typeof updates[key] === 'string') {
          medication[key] = sanitizeHtml(updates[key]);
        } else {
          medication[key] = updates[key];
        }
      }
    });

    await medication.save();

    return res.status(200).json({
      success: true,
      message: 'Medication updated successfully',
      medication
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update medication'
    });
  }
};

exports.deleteMedication = async (req, res) => {
  try {
    const { id } = req.params;

    const medication = await Medication.findOne({
      where: { id, userId: req.user.id }
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    await medication.destroy();

    return res.status(200).json({
      success: true,
      message: 'Medication deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete medication'
    });
  }
};

exports.getLowStock = async (req, res) => {
  try {
    const medications = await Medication.findAll({
      where: {
        userId: req.user.id,
        stockLevel: { [Op.lte]: 10 },
        isActive: true
      },
      order: [['stockLevel', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      count: medications.length,
      medications
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock items'
    });
  }
};
