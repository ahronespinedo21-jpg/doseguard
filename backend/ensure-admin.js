/**
 * ensure-admin.js
 * Ensures the admin user exists with a correctly bcrypt-hashed password.
 * Safe to run multiple times — it will fix rather than fail.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');
const { sequelize, User } = require('./models');

const ADMIN_EMAIL    = 'admin@doseguard.app';
const ADMIN_PASSWORD = 'admin123';

async function ensureAdmin(options = {}) {
  const isModule = options.isModule || false;
  try {
    if (!isModule) {
      console.log('🔄 Connecting to database...');
      await sequelize.authenticate();
      await sequelize.sync();
      console.log('✅ Database connected.');
    }

    // Resolve Firebase credentials
    const serviceAccountPath = path.join(__dirname, './serviceAccountKey.json');
    let serviceAccount = null;
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = require(serviceAccountPath);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch (err) {
        console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', err.message);
      }
    }

    const hasFirebaseCredentials = 
      fs.existsSync(serviceAccountPath) || 
      !!process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      !!process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!admin.apps.length) {
      if (serviceAccount) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log('[ADMIN-SETUP] Firebase Admin SDK initialized via Service Account credentials');
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp();
        console.log('[ADMIN-SETUP] Firebase Admin SDK initialized via Application Default Credentials');
      } else {
        admin.initializeApp({ projectId: 'doseguard-8c345' });
        console.log('[ADMIN-SETUP] Firebase Admin SDK initialized via Project ID fallback (no credentials)');
      }
    }

    let firebaseUid = 'admin-doseguard'; // Fallback ID

    if (hasFirebaseCredentials) {
      try {
        const userRecord = await admin.auth().getUserByEmail(ADMIN_EMAIL);
        firebaseUid = userRecord.uid;
        console.log(`[ADMIN-SETUP] ✅ Found existing Firebase User with UID: ${firebaseUid}`);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          console.log(`[ADMIN-SETUP] ℹ️ Creating admin in Firebase Authentication...`);
          const userRecord = await admin.auth().createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            displayName: 'Admin DoseGuard'
          });
          firebaseUid = userRecord.uid;
          console.log(`[ADMIN-SETUP] ✅ Created Firebase User with UID: ${firebaseUid}`);
        } else {
          console.warn(`[ADMIN-SETUP] ⚠️ Firebase Admin lookup failed, using fallback ID:`, error.message);
        }
      }
    } else {
      console.log(`[ADMIN-SETUP] ℹ️ Firebase credentials not configured. Using fallback ID: ${firebaseUid}`);
    }

    // Check if user exists in local SQL Database
    const existing = await User.findOne({ where: { email: ADMIN_EMAIL } });

    if (!existing) {
      console.log(`[ADMIN-SETUP] ℹ️ Creating admin in database with ID: ${firebaseUid}`);
      await User.create({
        id: firebaseUid,
        firstName: 'Admin',
        lastName: 'DoseGuard',
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: 'admin',
        isActive: true
      });
      console.log('[ADMIN-SETUP] ✅ Admin user successfully seeded into database.');
    } else {
      console.log('[ADMIN-SETUP] ℹ️ Admin user found in database. Validating details...');
      let needsSave = false;

      if (existing.id !== firebaseUid) {
        console.log(`[ADMIN-SETUP] ⚠️ ID mismatch. Changing from '${existing.id}' to '${firebaseUid}'...`);
        // Sequelize primary keys require recreation or direct update if permitted.
        // It is cleanest and most correct to destroy the old row and recreate it.
        await existing.destroy();
        await User.create({
          id: firebaseUid,
          firstName: existing.firstName || 'Admin',
          lastName: existing.lastName || 'DoseGuard',
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          role: 'admin',
          isActive: true
        });
        console.log('[ADMIN-SETUP] ✅ Admin user recreated with updated UID.');
        if (isModule) return;
      } else {
        const isCorrectPassword = await bcrypt.compare(ADMIN_PASSWORD, existing.password);
        if (!isCorrectPassword) {
          console.log('[ADMIN-SETUP] ⚠️ Password mismatch. Resetting password...');
          const salt = await bcrypt.genSalt(10);
          existing.password = await bcrypt.hash(ADMIN_PASSWORD, salt);
          needsSave = true;
        }

        if (existing.role !== 'admin') {
          existing.role = 'admin';
          needsSave = true;
        }

        if (!existing.isActive) {
          existing.isActive = true;
          needsSave = true;
        }

        if (needsSave) {
          await existing.save({ hooks: false });
          console.log('[ADMIN-SETUP] ✅ Admin user properties corrected in database.');
        } else {
          console.log('[ADMIN-SETUP] ✅ Admin database properties are already correct.');
        }
      }
    }

    // Final verification: do a dry-run comparePassword
    const adminUser = await User.findOne({ where: { email: ADMIN_EMAIL } });
    const verified  = await adminUser.comparePassword(ADMIN_PASSWORD);

    console.log('\n══════════════════════════════════════');
    if (verified) {
      console.log('🎉 ADMIN LOGIN VERIFIED SUCCESSFULLY!');
    } else {
      console.log('❌ Verification failed — manual DB inspection needed.');
    }
    console.log('══════════════════════════════════════');
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log('   Role:     admin');
    console.log('   Active:   true');
    console.log('══════════════════════════════════════\n');

    if (!isModule) {
      process.exit(verified ? 0 : 1);
    }
  } catch (err) {
    console.error('[ADMIN-SETUP] ❌ Error establishing admin:', err.message);
    if (!isModule) {
      process.exit(1);
    }
    throw err;
  }
}

if (require.main === module) {
  ensureAdmin();
} else {
  module.exports = ensureAdmin;
}
