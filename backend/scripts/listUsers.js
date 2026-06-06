const User = require('../models/User');
const sequelize = require('../config/database');

// List all users
async function listUsers() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    console.log('🔍 Fetching all users...');
    const users = await User.findAll({
      attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'isActive', 'lastLogin', 'createdAt']
    });

    if (users.length === 0) {
      console.log('⚠️ No users found in the database');
      console.log('💡 Run "node scripts/createAdmin.js" to create an admin account');
    } else {
      console.log(`\n📋 Found ${users.length} user(s):\n`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      users.forEach((user, index) => {
        console.log(`\n👤 User #${index + 1}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.firstName} ${user.lastName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.isActive ? '✅ Yes' : '❌ No'}`);
        console.log(`   Last Login: ${user.lastLogin ? user.lastLogin.toISOString() : 'Never'}`);
        console.log(`   Created: ${user.createdAt.toISOString()}`);
      });
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n💡 To create an admin account, run: node scripts/createAdmin.js');
      console.log('💡 To reset a password, you need to delete the user and recreate them');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error listing users:', error);
    process.exit(1);
  }
}

listUsers();
