const User = require('../models/User');
const sequelize = require('../config/database');

// Create admin user
async function createAdmin() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    const adminEmail = 'admin@doseguard.com';
    console.log('🔍 Checking if admin user exists with email:', adminEmail);
    
    const existingAdmin = await User.findOne({ where: { email: adminEmail } });

    if (existingAdmin) {
      console.log('⚠️ Admin user already exists');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 Admin email:', existingAdmin.email);
      console.log('👤 Admin name:', existingAdmin.firstName, existingAdmin.lastName);
      console.log('🎭 Role:', existingAdmin.role);
      console.log('✅ Active:', existingAdmin.isActive ? 'Yes' : 'No');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔑 Default password: admin123');
      console.log('');
      console.log('💡 If you forgot the password, run:');
      console.log('   node scripts/resetPassword.js admin@doseguard.com');
      process.exit(0);
    }

    console.log('📝 Creating new admin user...');
    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: adminEmail,
      password: 'admin123', // This will be automatically hashed by the model hook
      role: 'admin',
      isActive: true
    });

    console.log('✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Password: admin123');
    console.log('👤 Name:', admin.firstName, admin.lastName);
    console.log('🎭 Role:', admin.role);
    console.log('✅ Active:', admin.isActive ? 'Yes' : 'No');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⚠️ IMPORTANT: Please change the password after first login!');
    console.log('💡 Login URL: http://localhost:4200/login');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

createAdmin();
