const { User, Medication, ReminderLog } = require('./models');
require('dotenv').config();

async function createNewUserWithData() {
  try {
    console.log('\n📝 Creating New User with Full Data...\n');

    // Create new user
    const newUser = await User.create({
      firstName: 'Maria',
      lastName: 'Santos',
      email: 'maria@doseguard.app',
      password: 'maria123',
      phone: '+63-9175551234',
      dateOfBirth: new Date('1985-05-20'),
      address: 'Manila, Philippines',
      role: 'user',
      isActive: true
    });

    console.log(`✅ New User Created: ${newUser.firstName} ${newUser.lastName}`);
    console.log(`   Email: ${newUser.email}\n`);

    // Create medications for this new user
    console.log('🔄 Adding medications to new user...\n');

    const medications = [
      {
        userId: newUser.id,
        name: 'Losartan',
        dosage: '50mg',
        dosageType: 'specific',
        frequency: 'Once daily',
        timeSchedule: JSON.stringify(['06:00']),
        amount: 30,
        category: 'Blood Pressure',
        startDate: new Date('2026-01-01'),
        endDate: null,
        stockLevel: 28,
        notes: 'For hypertension management',
        isPillboxConnected: false,
        isActive: true
      },
      {
        userId: newUser.id,
        name: 'Omeprazole',
        dosage: '20mg',
        dosageType: 'specific',
        frequency: 'Once daily',
        timeSchedule: JSON.stringify(['07:00']),
        amount: 30,
        category: 'Acid Reflux',
        startDate: new Date('2025-11-15'),
        endDate: null,
        stockLevel: 15,
        notes: 'Take 30 minutes before breakfast',
        isPillboxConnected: false,
        isActive: true
      },
      {
        userId: newUser.id,
        name: 'Atorvastatin',
        dosage: '40mg',
        dosageType: 'specific',
        frequency: 'Once daily',
        timeSchedule: JSON.stringify(['20:00']),
        amount: 30,
        category: 'Cholesterol',
        startDate: new Date('2024-06-10'),
        endDate: null,
        stockLevel: 3,
        notes: 'Take in the evening with food',
        isPillboxConnected: false,
        isActive: true
      },
      {
        userId: newUser.id,
        name: 'Aspirin',
        dosage: '100mg',
        dosageType: 'specific',
        frequency: 'Once daily',
        timeSchedule: JSON.stringify(['09:00']),
        amount: 90,
        category: 'Pain Relief',
        startDate: new Date('2025-02-01'),
        endDate: null,
        stockLevel: 70,
        notes: 'Low dose aspirin for heart health',
        isPillboxConnected: false,
        isActive: true
      }
    ];

    const createdMeds = await Medication.bulkCreate(medications);
    console.log(`✅ Created ${createdMeds.length} medications for user\n`);

    // Create reminder logs for this user
    console.log('🔄 Adding reminder history...\n');

    const reminders = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Add 5 days of reminder history
    for (let i = 0; i < 5; i++) {
      const logDate = new Date(today);
      logDate.setDate(logDate.getDate() - i);

      for (const med of createdMeds) {
        const schedule = JSON.parse(med.timeSchedule);
        for (const time of schedule) {
          const random = Math.random();
          let status = 'taken';
          if (random > 0.9) status = 'missed';
          else if (random > 0.8) status = 'snoozed';

          reminders.push({
            userId: newUser.id,
            medicationId: med.id,
            status,
            scheduledTime: time,
            takenTime: status === 'taken' ? time : null,
            date: logDate,
            notes: status === 'taken' ? 'Taken as scheduled' : status === 'missed' ? 'Forgot to take' : 'Snoozed reminder'
          });
        }
      }
    }

    await ReminderLog.bulkCreate(reminders);
    console.log(`✅ Created ${reminders.length} reminder logs (5 days history)\n`);

    // Calculate adherence
    const stats = {
      taken: reminders.filter(r => r.status === 'taken').length,
      missed: reminders.filter(r => r.status === 'missed').length,
      snoozed: reminders.filter(r => r.status === 'snoozed').length,
      total: reminders.length
    };
    const adherence = ((stats.taken / stats.total) * 100).toFixed(1);

    console.log('\n' + '═'.repeat(70));
    console.log('✅ NEW USER CREATED WITH FULL DATABASE INFORMATION');
    console.log('═'.repeat(70));

    console.log(`\n👤 User Profile:`);
    console.log(`   Name: ${newUser.firstName} ${newUser.lastName}`);
    console.log(`   Email: ${newUser.email}`);
    console.log(`   Phone: ${newUser.phone}`);
    console.log(`   Birthday: ${newUser.dateOfBirth.toLocaleDateString()}`);
    console.log(`   Address: ${newUser.address}`);
    console.log(`   Role: ${newUser.role}`);

    console.log(`\n💊 Medications (${createdMeds.length}):`);
    createdMeds.forEach((med, idx) => {
      const icon = med.stockLevel <= 5 ? '⚠️ ' : '✅ ';
      console.log(`   ${idx + 1}. ${icon}${med.name}`);
      console.log(`      Dosage: ${med.dosage} - ${med.frequency}`);
      console.log(`      Schedule: ${med.timeSchedule}`);
      console.log(`      Stock: ${med.stockLevel} units`);
      console.log(`      Notes: ${med.notes}`);
    });

    console.log(`\n📋 Reminder History:`);
    console.log(`   Total Reminders: ${stats.total}`);
    console.log(`   ✅ Taken: ${stats.taken} (${adherence}%)`);
    console.log(`   ❌ Missed: ${stats.missed}`);
    console.log(`   ⏱️  Snoozed: ${stats.snoozed}`);
    console.log(`   📈 Adherence Rate: ${adherence}%`);

    console.log(`\n🔐 Login Credentials (USE THIS TO TEST):`);
    console.log('═'.repeat(70));
    console.log(`   Email: ${newUser.email}`);
    console.log(`   Password: maria123`);
    console.log('═'.repeat(70));

    console.log(`\n📊 What You'll See After Login:`);
    console.log(`   ✅ Dashboard with 4 medications`);
    console.log(`   ✅ 1 low stock alert (Atorvastatin - 3 units)`);
    console.log(`   ✅ 20 reminder logs from past 5 days`);
    console.log(`   ✅ Adherence stats (${adherence}%)`);
    console.log(`   ✅ Upcoming reminders for today`);
    console.log(`   ✅ Full user profile information`);

    console.log(`\n🔗 Test Endpoints:`);
    console.log(`   1. Login: POST /api/auth/login`);
    console.log(`      {`);
    console.log(`        "email": "${newUser.email}",`);
    console.log(`        "password": "maria123"`);
    console.log(`      }`);
    console.log(`   2. Get Medications: GET /api/medications`);
    console.log(`      Header: Authorization: Bearer <token>`);
    console.log(`      Result: Returns 4 medications`);
    console.log(`   3. Get Reminders: GET /api/reminders/logs`);
    console.log(`      Header: Authorization: Bearer <token>`);
    console.log(`      Result: Returns 20 reminder records`);
    console.log(`   4. Get Adherence: GET /api/reminders/adherence`);
    console.log(`      Header: Authorization: Bearer <token>`);
    console.log(`      Result: Returns ${adherence}% adherence rate`);

    console.log('\n' + '═'.repeat(70) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating new user:', error.message);
    process.exit(1);
  }
}

createNewUserWithData();
