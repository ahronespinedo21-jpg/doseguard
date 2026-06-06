const sequelize = require('../config/database');
const User = require('./User');
const Medication = require('./Medication');
const ReminderLog = require('./ReminderLog');

User.hasMany(Medication, { foreignKey: 'userId' });
Medication.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(ReminderLog, { foreignKey: 'userId' });
ReminderLog.belongsTo(User, { foreignKey: 'userId' });

Medication.hasMany(ReminderLog, { foreignKey: 'medicationId' });
ReminderLog.belongsTo(Medication, { foreignKey: 'medicationId' });

module.exports = {
  sequelize,
  User,
  Medication,
  ReminderLog
};
