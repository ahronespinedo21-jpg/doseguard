/**
 * reset-admin-password.js
 * 
 * Resets the Firebase Auth password for admin@doseguard.app
 * using the Firebase Admin SDK (no current password required).
 *
 * SETUP (one-time):
 *   1. Go to: https://console.firebase.google.com/project/doseguard-8c345/settings/serviceaccounts/adminsdk
 *   2. Click "Generate new private key" → Save as:
 *      c:\xampp\htdocs\DoseGuard Medication Reminder App\backend\serviceAccountKey.json
 *   3. Run: node reset-admin-password.js
 */

const path = require('path');

// ── Config ───────────────────────────────────────────────────────────────────
const ADMIN_EMAIL   = 'admin@doseguard.app';
const NEW_PASSWORD  = process.argv[2] || 'Admin@DoseGuard2024';
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
// ─────────────────────────────────────────────────────────────────────────────

// Validate service account file exists
const fs = require('fs');
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('\n❌ serviceAccountKey.json not found at:');
  console.error('   ' + SERVICE_ACCOUNT_PATH);
  console.error('\nTo generate it:');
  console.error('  1. Open: https://console.firebase.google.com/project/doseguard-8c345/settings/serviceaccounts/adminsdk');
  console.error('  2. Click "Generate new private key"');
  console.error('  3. Save the downloaded file as: serviceAccountKey.json');
  console.error('  4. Place it in: backend/serviceAccountKey.json');
  console.error('  5. Run this script again.\n');
  process.exit(1);
}

let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('❌ firebase-admin not installed. Run: npm install firebase-admin');
  process.exit(1);
}

// Safe initialization — prevent "app already exists" error
if (!admin.apps.length) {
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('[ADMIN] Firebase Admin SDK initialized.');
} else {
  console.log('[ADMIN] Firebase Admin SDK already initialized, reusing.');
}

async function main() {
  console.log('\n[ADMIN] Looking up user:', ADMIN_EMAIL);

  // Find user by email
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(ADMIN_EMAIL);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error('❌ No Firebase Auth account found for:', ADMIN_EMAIL);
      console.error('\nCreate the account at:');
      console.error('  https://console.firebase.google.com/project/doseguard-8c345/authentication/users');
      console.error('  Click "Add user" → enter email + password → Save\n');
      process.exit(1);
    }
    throw err;
  }

  console.log('[ADMIN] Found user. UID:', userRecord.uid);
  console.log('[ADMIN] Updating password to:', NEW_PASSWORD);

  // Update the password — no current password required with Admin SDK
  await admin.auth().updateUser(userRecord.uid, {
    password: NEW_PASSWORD
  });

  console.log('\n✅ Password updated successfully!');
  console.log('──────────────────────────────────────────');
  console.log('  Email   :', ADMIN_EMAIL);
  console.log('  Password:', NEW_PASSWORD);
  console.log('  UID     :', userRecord.uid);
  console.log('──────────────────────────────────────────');
  console.log('\n✅ You can now log in to /admin-login with these credentials.\n');

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Unexpected error:', err.message || err);
  if (err.code) console.error('   Error code:', err.code);
  process.exit(1);
});
