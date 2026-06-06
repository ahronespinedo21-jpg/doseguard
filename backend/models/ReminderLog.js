const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReminderLog = sequelize.define('ReminderLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  medicationId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Medications',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'taken', 'missed', 'snoozed', 'skipped'),
    allowNull: false,
    defaultValue: 'pending'
  },
  scheduledTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  takenTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'date']
    },
    {
      fields: ['medicationId', 'status']
    }
  ]
});

module.exports = ReminderLog;
