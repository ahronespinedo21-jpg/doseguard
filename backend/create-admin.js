const { User } = require('./models');
require('dotenv').config();

async function createAdminUser() {
  try {
    console.log('\n🔐 Creating Admin User for DoseGuard...\n');

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      where: { email: 'admin@doseguard.app' }
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('\n📋 Admin Credentials:');
      console.log('   Email: admin@doseguard.app');
      console.log('   Password: admin123');
      console.log('\n💡 Tip: Use these credentials to login to the admin dashboard\n');
      process.exit(0);
    }

    // Create admin user
    const adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'DoseGuard',
      email: 'admin@doseguard.app',
      password: 'admin123',
      phone: '+1-800-DOSEGUARD',
      role: 'admin',
      isActive: true
    });

    console.log('✅ Admin user created successfully!\n');
    console.log('📋 Admin Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Email: admin@doseguard.app');
    console.log('   Password: admin123');
    console.log('   Role: Administrator');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔗 Admin Access Points:');
    console.log('   1. Login: POST /api/auth/login');
    console.log('   2. Dashboard: /admin (in Angular app)');
    console.log('   3. Admin API: GET /api/admin/stats/system\n');
    console.log('💡 Next steps:');
    console.log('   1. Login to the app with these credentials');
    console.log('   2. Access admin dashboard to manage users');
    console.log('   3. View system statistics and medication logs\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
    process.exit(1);
  }
}

createAdminUser();
