const User = require('../models/User');
const sequelize = require('../config/database');

// Reset user password
async function resetPassword() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('❌ Usage: node scripts/resetPassword.js <email> [new_password]');
    console.log('   Example: node scripts/resetPassword.js admin@doseguard.com newpass123');
    console.log('   If no password is provided, default will be "admin123"');
    process.exit(1);
  }

  const email = args[0];
  const newPassword = args[1] || 'admin123';

  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    console.log(`🔍 Looking for user with email: ${email}`);
    const user = await User.findOne({ where: { email } });

    if (!user) {
      console.log('❌ User not found with email:', email);
      console.log('💡 Run "node scripts/listUsers.js" to see all users');
      process.exit(1);
    }

    console.log(`✅ User found: ${user.firstName} ${user.lastName}`);
    console.log(`🔄 Resetting password...`);
    
    user.password = newPassword;
    await user.save();

    console.log('✅ Password reset successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔑 New Password: ${newPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️ IMPORTANT: Please change the password after login!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  }
}

resetPassword();
