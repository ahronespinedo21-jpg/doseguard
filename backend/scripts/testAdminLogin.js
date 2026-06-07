const User = require('../models/User');
const sequelize = require('../config/database');

// Test admin login
async function testAdminLogin() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    const adminEmail = 'admin@doseguard.app';
    const testPassword = 'admin123';

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Testing Admin Login');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 1: Check if admin exists
    console.log('Step 1: Checking if admin exists...');
    const admin = await User.findOne({ where: { email: adminEmail } });
    
    if (!admin) {
      console.log('❌ Admin not found in database');
      console.log('💡 Run: node scripts/createAdmin.js to create admin account');
      process.exit(1);
    }

    console.log('✅ Admin found');
    console.log('   Email:', admin.email);
    console.log('   Name:', admin.firstName, admin.lastName);
    console.log('   Role:', admin.role);
    console.log('   Active:', admin.isActive ? 'Yes' : 'No');
    console.log('');

    // Step 2: Test password comparison
    console.log('Step 2: Testing password comparison...');
    console.log('   Input password:', testPassword);
    console.log('   Stored hash length:', admin.password.length);
    
    const isMatch = await admin.comparePassword(testPassword);
    
    if (isMatch) {
      console.log('✅ Password match successful!');
    } else {
      console.log('❌ Password mismatch!');
      console.log(`💡 Run: node scripts/resetPassword.js ${adminEmail} to reset password`);
      process.exit(1);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All tests passed! Admin login should work.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📧 Login with:');
    console.log(`   Email: ${adminEmail}`);
    console.log('   Password: admin123');
    console.log('');
    console.log('💡 Make sure the backend server is running:');
    console.log('   cd backend && npm start');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testAdminLogin();
