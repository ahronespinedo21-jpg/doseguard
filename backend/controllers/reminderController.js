const ReminderLog = require('../models/ReminderLog');
const Medication = require('../models/Medication');
const { Op } = require('sequelize');
const { sequelize } = require('../models');
const validator = require('validator');

exports.logReminder = async (req, res) => {
  try {
    const { medicationId, status, scheduledTime, takenTime, notes } = req.body;

    if (!medicationId || !status || !scheduledTime) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Sanitize inputs
    const safeNotes = notes ? validator.escape(notes) : null;
    const safeStatus = validator.escape(status);
    const safeMedId = validator.escape(medicationId.toString());

    const medication = await Medication.findOne({
      where: { id: safeMedId, userId: req.user.id }
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Look for an existing pending log for this medication and time today
    const existingLog = await ReminderLog.findOne({
      where: {
        userId: req.user.id,
        medicationId: safeMedId,
        scheduledTime,
        date: { [Op.gte]: today },
        status: 'pending'
      }
    });

    let log;
    if (existingLog) {
      log = await existingLog.update({
        status: safeStatus,
        takenTime: takenTime || new Date().toLocaleTimeString('en-GB', { hour12: false }),
        notes: safeNotes
      });
    } else {
      log = await ReminderLog.create({
        userId: req.user.id,
        medicationId: safeMedId,
        status: safeStatus,
        scheduledTime,
        takenTime: takenTime || null,
        date: new Date(),
        notes: safeNotes
      });
    }

    return res.status(200).json({
      success: true,
      message: `Medication marked as ${safeStatus}`,
      log
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to log reminder'
    });
  }
};

exports.syncOfflineLogs = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { logs } = req.body;
    
    if (!logs || !Array.isArray(logs)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    let syncedCount = 0;
    for (const logData of logs) {
      const safeMedId = validator.escape(logData.medicationId.toString());
      const safeStatus = validator.escape(logData.status);

      // Verify ownership
      const medication = await Medication.findOne({
        where: { id: safeMedId, userId: req.user.id },
        transaction
      });

      if (medication) {
        // Create or update the log
        await ReminderLog.create({
          userId: req.user.id,
          medicationId: safeMedId,
          status: safeStatus,
          scheduledTime: logData.scheduledTime,
          takenTime: logData.actualTime || null,
          date: new Date(logData.date),
          notes: 'Synced from offline'
        }, { transaction });
        syncedCount++;
      }
    }

    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: `Successfully synced ${syncedCount} logs`,
      count: syncedCount
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    console.error('❌ syncOfflineLogs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync offline logs'
    });
  }
};

exports.getReminderLogs = async (req, res) => {
  try {
    const { startDate, endDate, medicationId } = req.query;
    const where = { userId: req.user.id };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date[Op.gte] = new Date(startDate);
      if (endDate) where.date[Op.lte] = new Date(endDate);
    }

    if (medicationId) where.medicationId = medicationId;

    const logs = await ReminderLog.findAll({
      where,
      include: [
        {
          model: Medication,
          attributes: ['id', 'name', 'dosage']
        }
      ],
      order: [['date', 'DESC'], ['scheduledTime', 'DESC']]
    });

    // Deduplicate database rows to prevent duplicates (same medication, same slot)
    const uniqueLogs = [];
    const seen = new Set();
    for (const log of logs) {
      const dateStr = log.date ? new Date(log.date).toISOString().split('T')[0] : '';
      // Key DOES NOT include status now - we only want the most recent state for this slot
      const key = `${log.medicationId}_${dateStr}_${log.scheduledTime}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueLogs.push(log);
      }
    }

    let finalLogs = uniqueLogs;
    if (req.query.limit) {
      finalLogs = uniqueLogs.slice(0, parseInt(req.query.limit, 10));
    }

    return res.status(200).json({
      success: true,
      count: finalLogs.length,
      logs: finalLogs
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reminder logs'
    });
  }
};

exports.getAdherence = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = { userId: req.user.id };

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    where.date = {
      [Op.gte]: start,
      [Op.lte]: end
    };

    const logs = await ReminderLog.findAll({ where });

    const stats = {
      total: logs.length,
      taken: logs.filter(l => l.status === 'taken').length,
      missed: logs.filter(l => l.status === 'missed').length,
      snoozed: logs.filter(l => l.status === 'snoozed').length,
      skipped: logs.filter(l => l.status === 'skipped').length,
      adherenceRate: logs.length > 0 ? ((logs.filter(l => l.status === 'taken').length / logs.length) * 100).toFixed(2) : 0,
      startDate: start,
      endDate: end
    };

    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate adherence'
    });
  }
};

exports.getTodayReminders = async (req, res) => {
  try {
    // Use UTC dates for consistency with creation
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    console.log('🔍 getTodayReminders called for user:', req.user.id);
    console.log('   Date range (UTC):', today.toISOString(), 'to', tomorrow.toISOString());

    // First, check if there are existing logs for today
    const logs = await ReminderLog.findAll({
      where: {
        userId: req.user.id,
        date: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      },
      include: [
        {
          model: Medication,
          attributes: ['id', 'name', 'dosage', 'category']
        }
      ],
      order: [['scheduledTime', 'ASC']]
    });

    console.log('   Found', logs.length, 'existing reminder logs');

    // If no logs exist, generate them from medications
    if (logs.length === 0) {
      console.log('   No logs found, generating from medications...');
      
      // Get all medications for this user
      const medications = await Medication.findAll({
        where: { userId: req.user.id }
      });

      console.log('   Found', medications.length, 'medications');

      // Generate reminder logs for each medication with reminder times
      const generatedLogs = [];
      for (const medication of medications) {
        const timeSchedule = medication.timeSchedule;
        if (timeSchedule && Array.isArray(timeSchedule) && timeSchedule.length > 0) {
          for (const time of timeSchedule) {
            try {
              const log = await ReminderLog.create({
                userId: req.user.id,
                medicationId: medication.id,
                status: 'pending',
                scheduledTime: time,
                date: new Date()
              });
              generatedLogs.push(log);
            } catch (err) {
              console.error('   Error creating log for medication', medication.id, ':', err);
            }
          }
        }
      }

      console.log('   Generated', generatedLogs.length, 'reminder logs');

      // Fetch the newly created logs with medication details
      const newLogs = await ReminderLog.findAll({
        where: {
          userId: req.user.id,
          date: {
            [Op.gte]: today,
            [Op.lt]: tomorrow
          }
        },
        include: [
          {
            model: Medication,
            attributes: ['id', 'name', 'dosage', 'category']
          }
        ],
        order: [['scheduledTime', 'ASC']]
      });

      return res.status(200).json({
        success: true,
        count: newLogs.length,
        logs: newLogs
      });
    }

    if (logs.length > 0) {
      console.log('   First reminder:', {
        id: logs[0].id,
        medicationId: logs[0].medicationId,
        scheduledTime: logs[0].scheduledTime,
        status: logs[0].status,
        date: logs[0].date,
        Medication: logs[0].Medication?.name
      });
    }

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('❌ getTodayReminders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch today reminders'
    });
  }
};
