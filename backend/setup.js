const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
  try {
    console.log('🔄 Starting DoseGuard Backend Setup...\n');

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Connected to MySQL');

    const dbName = process.env.DB_NAME || 'doseguard_db';
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database '${dbName}' created/verified`);

    await connection.end();

    console.log('\n🔄 Syncing database models...');
    const { sequelize } = require('./models');
    await sequelize.sync({ alter: true, force: false });
    console.log('✅ Database models synchronized');

    console.log('\n🎉 Setup Complete!');
    console.log('\n📝 Next Steps:');
    console.log('   1. npm run dev  (to start development server)');
    console.log('   2. API will be available at http://localhost:3001\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('\n⚠️  Make sure:');
    console.error('   • MySQL (XAMPP) is running');
    console.error('   • .env file is configured correctly');
    console.error('   • Dependencies are installed (npm install)\n');
    process.exit(1);
  }
}

setupDatabase();
