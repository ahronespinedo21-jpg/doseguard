const { User, Medication, ReminderLog } = require('./models');
require('dotenv').config();

async function createTestData() {
  try {
    console.log('\n📊 Creating Test Data for DoseGuard...\n');

    // Find the demo user
    const demoUser = await User.findOne({
      where: { email: 'demo@doseguard.app' }
    });

    if (!demoUser) {
      console.log('❌ Demo user not found! Creating test data for Demo User failed.');
      console.log('💡 Please register a user first via the app or API\n');
      process.exit(1);
    }

    console.log(`✅ Found User: ${demoUser.firstName} ${demoUser.lastName}`);

    // Check existing medications
    const existingMeds = await Medication.count({
      where: { userId: demoUser.id }
    });

    if (existingMeds > 0) {
      console.log(`⚠️  User already has ${existingMeds} medications!\n`);
      showTestData(demoUser);
      process.exit(0);
    }

    // Create test medications
    console.log('\n🔄 Adding test medications...\n');

    const medications = [
      {
        userId: demoUser.id,
        name: 'Aspirin',
        dosage: '500mg',
        dosageType: 'specific',
        frequency: 'Twice daily',
        timeSchedule: JSON.stringify(['08:00', '20:00']),
        amount: 30,
        category: 'Pain Relief',
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-12-31'),
        stockLevel: 25,
        notes: 'Take with food if stomach upset',
        isPillboxConnected: false,
        isActive: true
      },
      {
        userId: demoUser.id,
        name: 'Metformin',
        dosage: '850mg',
        dosageType: 'specific',
        frequency: 'Three times daily',
        timeSchedule: JSON.stringify(['07:00', '13:00', '19:00']),
        amount: 90,
        category: 'Diabetes',
        startDate: new Date('2025-06-01'),
        endDate: null,
        stockLevel: 45,
        notes: 'Ongoing medication for diabetes management',
        isPillboxConnected: true,
        isActive: true
      },
      {
        userId: demoUser.id,
        name: 'Lisinopril',
        dosage: '10mg',
        dosageType: 'specific',
        frequency: 'Once daily',
        timeSchedule: JSON.stringify(['09:00']),
        amount: 30,
        category: 'Blood Pressure',
        startDate: new Date('2025-03-20'),
        endDate: null,
        stockLevel: 8,
        notes: 'Take in the morning. Monitor blood pressure',
        isPillboxConnected: false,
        isActive: true
      },
      {
        userId: demoUser.id,
        name: 'Vitamin D3',
        dosage: '2000 IU',
        dosageType: 'specific',
        frequency: 'Once daily',
        timeSchedule: JSON.stringify(['12:00']),
        amount: 60,
        category: 'Supplements',
        startDate: new Date('2024-11-01'),
        endDate: null,
        stockLevel: 5,
        notes: 'Daily supplement for bone health',
        isPillboxConnected: false,
        isActive: true
      }
    ];

    const createdMeds = await Medication.bulkCreate(medications);
    console.log(`✅ Created ${createdMeds.length} medications\n`);

    // Create test reminder logs
    console.log('🔄 Adding reminder logs...\n');

    const reminders = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Add reminders for each medication
    for (let i = 0; i < 7; i++) {
      const logDate = new Date(today);
      logDate.setDate(logDate.getDate() - i);

      for (const med of createdMeds) {
        const schedule = JSON.parse(med.timeSchedule);
        for (const time of schedule) {
          const status = Math.random() > 0.15 ? 'taken' : (Math.random() > 0.5 ? 'missed' : 'snoozed');
          const takenTime = status === 'taken' ? time : null;

          reminders.push({
            userId: demoUser.id,
            medicationId: med.id,
            status,
            scheduledTime: time,
            takenTime,
            date: logDate,
            notes: status === 'taken' ? 'Taken as prescribed' : status === 'missed' ? 'Forgot to take' : 'Snoozed 30 mins'
          });
        }
      }
    }

    await ReminderLog.bulkCreate(reminders);
    console.log(`✅ Created ${reminders.length} reminder logs (7 days history)\n`);

    showTestData(demoUser, createdMeds, reminders);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test data:', error.message);
    process.exit(1);
  }
}

function showTestData(user, medications = [], reminders = []) {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 TEST DATA SUMMARY');
  console.log('═'.repeat(60));

  console.log(`\n👤 User: ${user.firstName} ${user.lastName}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role: ${user.role}`);

  if (medications.length > 0) {
    console.log(`\n💊 Medications (${medications.length}):`);
    medications.forEach((med, idx) => {
      console.log(`   ${idx + 1}. ${med.name}`);
      console.log(`      Dosage: ${med.dosage} - ${med.frequency}`);
      console.log(`      Stock: ${med.stockLevel} units`);
      if (med.stockLevel <= 10) console.log(`      ⚠️  LOW STOCK`);
    });
  }

  if (reminders.length > 0) {
    const stats = {
      taken: reminders.filter(r => r.status === 'taken').length,
      missed: reminders.filter(r => r.status === 'missed').length,
      snoozed: reminders.filter(r => r.status === 'snoozed').length,
      total: reminders.length
    };

    const adherence = ((stats.taken / stats.total) * 100).toFixed(1);

    console.log(`\n📋 Reminder History:`);
    console.log(`   Total Reminders: ${stats.total}`);
    console.log(`   ✅ Taken: ${stats.taken}`);
    console.log(`   ❌ Missed: ${stats.missed}`);
    console.log(`   ⏱️  Snoozed: ${stats.snoozed}`);
    console.log(`   📈 Adherence Rate: ${adherence}%`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🔐 Login Credentials:');
  console.log('═'.repeat(60));
  console.log(`Email: demo@doseguard.app`);
  console.log(`Password: demo123`);
  console.log('\n💡 What to expect when you login:');
  console.log('   • Dashboard showing 4 active medications');
  console.log('   • Low stock alert for Vitamin D3 (5 units)');
  console.log('   • 7 days of reminder history');
  console.log('   • Adherence rate around 85%');
  console.log('   • Upcoming reminders for today');
  console.log('\n' + '═'.repeat(60) + '\n');
}

createTestData();
