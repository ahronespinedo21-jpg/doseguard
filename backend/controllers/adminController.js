const User = require('../models/User');
const Medication = require('../models/Medication');
const ReminderLog = require('../models/ReminderLog');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK if not already initialized
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
const hasFirebaseCredentials = fs.existsSync(serviceAccountPath) || process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!admin.apps.length) {
  if (hasFirebaseCredentials) {
    if (fs.existsSync(serviceAccountPath)) {
      admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath))
      });
      console.log('[ADMIN] Firebase Admin SDK initialized via serviceAccountKey.json');
    } else {
      admin.initializeApp();
      console.log('[ADMIN] Firebase Admin SDK initialized via Application Default Credentials');
    }
  } else {
    admin.initializeApp({
      projectId: 'doseguard-8c345'
    });
    console.log('[ADMIN] Firebase Admin SDK initialized via Project ID fallback (doseguard-8c345) - NO CREDENTIALS CONFIGURED');
  }
}

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let medicationCount = 0;
    let reminderCount = 0;
    let takenCount = 0;

    try {
      if (!hasFirebaseCredentials) {
        throw new Error('Firebase credentials are not configured');
      }
      const db = admin.firestore();
      const medsSnapshot = await db.collection(`users/${userId}/medications`).get();
      medicationCount = medsSnapshot.size;

      const logsSnapshot = await db.collection(`users/${userId}/reminderLogs`).get();
      reminderCount = logsSnapshot.size;

      logsSnapshot.forEach(doc => {
        if (doc.data().status === 'taken') {
          takenCount++;
        }
      });
    } catch (firestoreError) {
      console.warn('[ADMIN] Firestore fetch failed for user details, using SQL fallback:', firestoreError.message);
      medicationCount = await Medication.count({ where: { userId } });
      reminderCount = await ReminderLog.count({ where: { userId } });
      takenCount = await ReminderLog.count({ where: { userId, status: 'taken' } });
    }

    return res.status(200).json({
      success: true,
      user,
      stats: {
        medications: medicationCount,
        reminders: reminderCount,
        taken: takenCount
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user details'
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Clean up Firestore data if possible
    try {
      if (!hasFirebaseCredentials) {
        throw new Error('Firebase credentials are not configured');
      }
      const db = admin.firestore();
      const batch = db.batch();
      
      const medsSnapshot = await db.collection(`users/${userId}/medications`).get();
      medsSnapshot.forEach(doc => batch.delete(doc.ref));

      const logsSnapshot = await db.collection(`users/${userId}/reminderLogs`).get();
      logsSnapshot.forEach(doc => batch.delete(doc.ref));

      await batch.commit();
      console.log(`[ADMIN] Cleaned up Firestore records for user: ${userId}`);
    } catch (firestoreError) {
      console.warn('[ADMIN] Failed to clean Firestore user subcollections:', firestoreError.message);
    }

    await Medication.destroy({ where: { userId } });
    await ReminderLog.destroy({ where: { userId } });
    await user.destroy();

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

exports.getAllMedications = async (req, res) => {
  try {
    let medications = [];
    try {
      if (!hasFirebaseCredentials) {
        throw new Error('Firebase credentials are not configured');
      }
      const db = admin.firestore();
      const snapshot = await db.collectionGroup('medications').get();
      snapshot.forEach(doc => {
        medications.push({ id: doc.id, ...doc.data() });
      });
    } catch (firestoreError) {
      console.warn('[ADMIN] Firestore fetch failed for all medications, using SQL fallback:', firestoreError.message);
      medications = await Medication.findAll({
        include: [
          {
            model: User,
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ],
        order: [['createdAt', 'DESC']]
      });
    }

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

exports.getAllReminderLogs = async (req, res) => {
  try {
    const { status } = req.query;
    let logs = [];

    try {
      if (!hasFirebaseCredentials) {
        throw new Error('Firebase credentials are not configured');
      }
      const db = admin.firestore();
      let queryRef = db.collectionGroup('reminderLogs');
      if (status) {
        queryRef = queryRef.where('status', '==', status);
      }
      
      const snapshot = await queryRef.get();
      snapshot.forEach(doc => {
        logs.push({ id: doc.id, ...doc.data() });
      });

      // Sort logs descending by timestamp/date
      logs.sort((a, b) => {
        const timeA = a.date || a.timestamp || '';
        const timeB = b.date || b.timestamp || '';
        return timeB.localeCompare(timeA);
      });
    } catch (firestoreError) {
      console.warn('[ADMIN] Firestore fetch failed for all logs, using SQL fallback:', firestoreError.message);
      const where = {};
      if (status) where.status = status;
      logs = await ReminderLog.findAll({
        where,
        include: [
          {
            model: User,
            attributes: ['id', 'firstName', 'lastName', 'email']
          },
          {
            model: Medication,
            attributes: ['id', 'name', 'dosage']
          }
        ],
        order: [['date', 'DESC']],
        limit: 1000
      });
    }

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reminder logs'
    });
  }
};

exports.getSystemStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    let totalMedications = 0;
    let totalReminders = 0;
    let takenReminders = 0;
    let missedReminders = 0;

    try {
      if (!hasFirebaseCredentials) {
        throw new Error('Firebase credentials are not configured');
      }
      const db = admin.firestore();
      const medicationsSnapshot = await db.collectionGroup('medications').get();
      totalMedications = medicationsSnapshot.size;

      const remindersSnapshot = await db.collectionGroup('reminderLogs').get();
      totalReminders = remindersSnapshot.size;

      remindersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'taken') {
          takenReminders++;
        } else if (data.status === 'missed') {
          missedReminders++;
        }
      });
    } catch (firestoreError) {
      console.warn('[ADMIN] Firestore fetch failed for system stats, using SQL fallback:', firestoreError.message);
      totalMedications = await Medication.count();
      totalReminders = await ReminderLog.count();
      takenReminders = await ReminderLog.count({ where: { status: 'taken' } });
      missedReminders = await ReminderLog.count({ where: { status: 'missed' } });
    }

    const stats = {
      totalUsers,
      totalMedications,
      totalReminders,
      takenReminders,
      missedReminders,
      adherenceRate: totalReminders > 0 ? (takenReminders / totalReminders * 100).toFixed(2) : 0
    };

    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch system statistics'
    });
  }
};

exports.getUserMedications = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let medications = [];

    try {
      if (!hasFirebaseCredentials) {
        throw new Error('Firebase credentials are not configured');
      }
      const db = admin.firestore();
      const snapshot = await db.collection(`users/${userId}/medications`).get();
      snapshot.forEach(doc => {
        medications.push({ id: doc.id, ...doc.data() });
      });
    } catch (firestoreError) {
      console.warn('[ADMIN] Firestore fetch failed for user medications, using SQL fallback:', firestoreError.message);
      medications = await Medication.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']]
      });
    }

    return res.status(200).json({
      success: true,
      count: medications.length,
      medications
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user medications'
    });
  }
};

exports.getUserAdherence = async (req, res) => {
  try {
    const { userId } = req.params;
    let total = 0;
    let taken = 0;
    let missed = 0;
    let pending = 0;

    try {
      if (!hasFirebaseCredentials) {
        throw new Error('Firebase credentials are not configured');
      }
      const db = admin.firestore();
      const snapshot = await db.collection(`users/${userId}/reminderLogs`).get();
      snapshot.forEach(doc => {
        total++;
        const data = doc.data();
        if (data.status === 'taken') taken++;
        else if (data.status === 'missed') missed++;
        else if (data.status === 'pending') pending++;
      });
    } catch (firestoreError) {
      console.warn('[ADMIN] Firestore fetch failed for user adherence, using SQL fallback:', firestoreError.message);
      total = await ReminderLog.count({ where: { userId } });
      taken = await ReminderLog.count({ where: { userId, status: 'taken' } });
      missed = await ReminderLog.count({ where: { userId, status: 'missed' } });
      pending = await ReminderLog.count({ where: { userId, status: 'pending' } });
    }

    return res.status(200).json({
      success: true,
      stats: {
        total,
        taken,
        missed,
        pending,
        adherenceRate: total > 0 ? (taken / total * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch adherence stats'
    });
  }
};

exports.getUserReminderLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    let logs = [];

    try {
      if (!hasFirebaseCredentials) {
        throw new Error('Firebase credentials are not configured');
      }
      const db = admin.firestore();
      const snapshot = await db.collection(`users/${userId}/reminderLogs`)
        .orderBy('date', 'desc')
        .limit(20)
        .get();
      
      snapshot.forEach(doc => {
        logs.push({ id: doc.id, ...doc.data() });
      });
    } catch (firestoreError) {
      console.warn('[ADMIN] Firestore fetch failed for user reminder logs, using SQL fallback:', firestoreError.message);
      logs = await ReminderLog.findAll({
        where: { userId },
        order: [['date', 'DESC']],
        limit: 20
      });
    }

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user reminder logs'
    });
  }
};

exports.deleteMedication = async (req, res) => {
  try {
    const { medicationId } = req.params;
    const { userId } = req.query;

    console.log('[ADMIN] Received delete medication request:', { medicationId, userId });

    if (!medicationId || !userId) {
      console.error('[ADMIN] Missing required parameters for deletion');
      return res.status(400).json({
        success: false,
        message: 'Medication ID and User ID are required'
      });
    }

    // Retrieve the medication from SQL first to get details like medication name
    const medication = await Medication.findOne({
      where: { id: medicationId, userId }
    });

    const medicationName = medication ? medication.name : 'Unknown Medication';

    // Synchronously clean up Firestore if firebase is active
    try {
      if (!hasFirebaseCredentials) {
        throw new Error('Firebase credentials are not configured');
      }
      const db = admin.firestore();
      
      // Delete the medication document
      const medDocRef = db.doc(`users/${userId}/medications/${medicationId}`);
      await medDocRef.delete();
      console.log(`[ADMIN] Deleted Firestore medication doc: users/${userId}/medications/${medicationId}`);

      // Delete associated reminder logs
      const logsRef = db.collection(`users/${userId}/reminderLogs`);
      const logsSnapshot = await logsRef.where('medicationId', '==', medicationId).get();
      if (!logsSnapshot.empty) {
        const batch = db.batch();
        logsSnapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`[ADMIN] Deleted ${logsSnapshot.size} associated Firestore reminder logs`);
      }

      // Write Audit Log
      const auditLogRef = db.collection('auditLogs').doc();
      await auditLogRef.set({
        userId: req.user ? req.user.id : 'ADMIN',
        medicationId,
        medicationName,
        timestamp: new Date().toISOString(),
        action: 'DELETE_MEDICATION'
      });
      console.log('[ADMIN] Created administrative delete audit log');
    } catch (firestoreError) {
      console.warn('[ADMIN] Firestore deletion or audit logging skipped/failed:', firestoreError.message);
    }

    // Delete associated reminder logs from MySQL database
    await ReminderLog.destroy({
      where: { medicationId }
    });

    // Delete medication from MySQL database
    if (medication) {
      await medication.destroy();
      console.log(`[ADMIN] Deleted SQL medication: ${medicationName} (${medicationId})`);
    } else {
      console.log(`[ADMIN] Medication was not found in SQL (or already deleted), proceeding`);
    }

    return res.status(200).json({
      success: true,
      message: 'Medication and its associated reminders were deleted successfully'
    });
  } catch (error) {
    console.error('[ADMIN] Error in deleteMedication controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete medication. Server error.'
    });
  }
};


