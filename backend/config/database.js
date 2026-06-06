const { Sequelize } = require('sequelize');
require('dotenv').config();

if (!process.env.DB_NAME) {
  throw new Error('❌ DB_NAME is not defined in .env');
}

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: false,
    timezone: '+00:00', // Use UTC for consistent date handling
    dialectOptions: {
      timezone: '+00:00', // MySQL timezone
      ...(process.env.DB_SSL === 'true' ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {})
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

sequelize.authenticate()
  .then(() => console.log('✅ Database connected successfully!'))
  .catch(err => console.error('❌ DB Connection Error:', err.message));

module.exports = sequelize; 