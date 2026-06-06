/**
 * ensure-admin.js
 * Ensures the admin user exists with a correctly bcrypt-hashed password.
 * Safe to run multiple times — it will fix rather than fail.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('./models');
const User = require('./models/User');

const ADMIN_EMAIL    = 'admin@doseguard.app';
const ADMIN_PASSWORD = 'admin123';

async function ensureAdmin() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log('\n✅ Database connected.\n');

    const existing = await User.findOne({ where: { email: ADMIN_EMAIL } });

    if (!existing) {
      // ── Case 1: Admin does not exist — create with correct hash ──────────
      console.log('ℹ️  Admin user not found. Creating...');
      await User.create({
        firstName: 'Admin',
        lastName:  'DoseGuard',
        email:     ADMIN_EMAIL,
        password:  ADMIN_PASSWORD,  // beforeCreate hook will bcrypt this
        role:      'admin',
        isActive:  true
      });
      console.log('✅ Admin user created with bcrypt-hashed password.');

    } else {
      // ── Case 2: Admin exists — verify password hash is correct ───────────
      console.log('ℹ️  Admin user found. Verifying password hash...');
      console.log('   Stored hash:', existing.password.substring(0, 20) + '...');

      const isHash = existing.password.startsWith('$2a$') || existing.password.startsWith('$2b$');

      if (!isHash) {
        // Plaintext stored — must rehash
        console.log('⚠️  Password is NOT hashed. Rehashing now...');
        const salt = await bcrypt.genSalt(10);
        existing.password = await bcrypt.hash(ADMIN_PASSWORD, salt);
        // Bypass beforeUpdate hook (already hashed manually above)
        await existing.save({ hooks: false });
        console.log('✅ Password rehashed and saved.');
      } else {
        // Hash exists — verify it matches admin123
        const match = await bcrypt.compare(ADMIN_PASSWORD, existing.password);
        if (!match) {
          console.log('⚠️  Hash does not match "admin123". Resetting password...');
          const salt = await bcrypt.genSalt(10);
          existing.password = await bcrypt.hash(ADMIN_PASSWORD, salt);
          await existing.save({ hooks: false });
          console.log('✅ Password reset to admin123 (bcrypt hashed).');
        } else {
          console.log('✅ Password hash is correct and matches "admin123".');
        }
      }

      // Ensure role is admin and account is active
      if (existing.role !== 'admin' || !existing.isActive) {
        existing.role     = 'admin';
        existing.isActive = true;
        await existing.save({ hooks: false });
        console.log('✅ Role and isActive status fixed.');
      }
    }

    // ── Final verification: do a dry-run comparePassword ─────────────────
    const adminUser = await User.findOne({ where: { email: ADMIN_EMAIL } });
    const verified  = await adminUser.comparePassword(ADMIN_PASSWORD);

    console.log('\n══════════════════════════════════════');
    if (verified) {
      console.log('🎉 ADMIN LOGIN VERIFIED SUCCESSFULLY!');
    } else {
      console.log('❌ Verification failed — manual DB inspection needed.');
    }
    console.log('══════════════════════════════════════');
    console.log('   Email:    admin@doseguard.app');
    console.log('   Password: admin123');
    console.log('   Role:     admin');
    console.log('   Active:   true');
    console.log('══════════════════════════════════════\n');

    process.exit(verified ? 0 : 1);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

ensureAdmin();
