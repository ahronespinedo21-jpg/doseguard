# DoseGuard Database - Complete Setup & Test Data

## ✅ Backend Status: RUNNING

- **Server**: http://localhost:3001
- **Database**: doseguard_db (MySQL connected)
- **Status**: ✅ All systems operational

---

## 📊 Database Contents

### Users Table (2 users)

#### 1. Admin User
```
Email: admin@doseguard.app
Password: admin123
Role: Administrator
Status: Active
Privileges: View all users, medications, statistics, manage system
```

#### 2. Demo User (Test Account)
```
Email: demo@doseguard.app
Password: demo123
Role: Regular User
Status: Active
Medications: 4 assigned
Reminders: 49 logged
Adherence Rate: 91.8%
```

---

## 💊 Medications in Database (4 Active)

### User: demo@doseguard.app

**1. Aspirin**
```
Dosage: 500mg
Frequency: Twice daily (08:00, 20:00)
Category: Pain Relief
Stock: 25 units
Status: Active
Notes: Take with food if stomach upset
```

**2. Metformin**
```
Dosage: 850mg
Frequency: Three times daily (07:00, 13:00, 19:00)
Category: Diabetes
Stock: 45 units
Status: Active
Pillbox Connected: Yes
Notes: Ongoing medication for diabetes management
```

**3. Lisinopril** ⚠️ LOW STOCK
```
Dosage: 10mg
Frequency: Once daily (09:00)
Category: Blood Pressure
Stock: 8 units ⚠️
Status: Active
Notes: Take in the morning. Monitor blood pressure
```

**4. Vitamin D3** ⚠️ LOW STOCK
```
Dosage: 2000 IU
Frequency: Once daily (12:00)
Category: Supplements
Stock: 5 units ⚠️
Status: Active
Notes: Daily supplement for bone health
```

---

## 📋 Reminder Logs (49 Historical Records)

### Statistics
- **Total Reminders**: 49
- **✅ Taken**: 45 (91.8%)
- **❌ Missed**: 1 (2.0%)
- **⏱️ Snoozed**: 3 (6.1%)
- **Period**: Last 7 days

### What This Shows
When user logs in, they will see:
- ✅ High medication adherence (91.8%)
- ✅ Most medications taken on schedule
- ⚠️ 2 medications with low stock
- 📈 Trending data for dashboard analytics

---

## 🔌 Available API Endpoints

### Authentication (No Auth Required)
```
POST   /api/auth/register        Create new user account
POST   /api/auth/login           Login & get JWT token
GET    /api/auth/verify-token    Verify token validity
```

### User Endpoints (Requires Login)
```
GET    /api/user/profile         Get user profile
PUT    /api/user/profile         Update profile
POST   /api/user/change-password Change password
DELETE /api/user/account         Delete account
```

### Medication Endpoints (Requires Login)
```
POST   /api/medications           Add new medication
GET    /api/medications           List user's medications
PUT    /api/medications/:id       Edit medication
DELETE /api/medications/:id       Delete medication
GET    /api/medications/low-stock Get low stock alerts
```

### Reminder Endpoints (Requires Login)
```
POST   /api/reminders/log         Log reminder status
GET    /api/reminders/logs        Get reminder history
GET    /api/reminders/adherence   Get adherence statistics
GET    /api/reminders/today       Get today's reminders
```

### Admin Endpoints (Admin Only)
```
GET    /api/admin/users            List all users
GET    /api/admin/users/:userId    Get user details
DELETE /api/admin/users/:userId    Delete user
GET    /api/admin/medications      List all medications
GET    /api/admin/reminder-logs    View all reminders
GET    /api/admin/stats/system     View system statistics
```

---

## 🧪 Test Flow

### Step 1: Login as Demo User
```json
POST /api/auth/login
{
  "email": "demo@doseguard.app",
  "password": "demo123"
}

Response: JWT token + user data + role
```

### Step 2: View Dashboard
```json
GET /api/medications
Authorization: Bearer <token>

Response: Array of 4 medications with full details
```

### Step 3: View Low Stock Alerts
```json
GET /api/medications/low-stock
Authorization: Bearer <token>

Response: 2 medications (Lisinopril, Vitamin D3)
```

### Step 4: Check Adherence Stats
```json
GET /api/reminders/adherence?startDate=2026-04-08&endDate=2026-04-15
Authorization: Bearer <token>

Response: {
  "total": 49,
  "taken": 45,
  "missed": 1,
  "snoozed": 3,
  "adherenceRate": 91.8%
}
```

### Step 5: View Reminder History
```json
GET /api/reminders/logs
Authorization: Bearer <token>

Response: Array of 49 reminder records with dates, times, status
```

---

## 📱 Angular App Integration

### What You'll See When Logged In

#### Dashboard Page
- ✅ 4 medication cards showing dosage, frequency, stock level
- ⚠️ Low stock badge on Lisinopril and Vitamin D3
- 📊 Medication chart/grid view
- 🎯 "Add Medication" button

#### Low Stock Alert Page
- ✅ 2 medication alerts
- 📉 Stock level indicators
- 🛒 "Refill" buttons (if connected)

#### Upcoming Reminders Page
- ✅ Reminders for today
- ⏰ Scheduled times
- ✅ Mark as taken / ❌ Mark as missed options
- ➕ Add quick notes

#### Reminder History / Adherence
- 📈 91.8% adherence rate
- 📊 Charts showing taken vs missed
- 📅 Weekly/monthly breakdown
- 🎯 Trend indicators

#### Settings
- ⚙️ Update profile
- 🔐 Change password
- 🔔 Notification preferences
- ❌ Delete account

---

## 🔐 Admin Dashboard Features

### Login as Admin
```
Email: admin@doseguard.app
Password: admin123
```

### Admin Can View
1. **System Statistics**
   - Total Users: 2
   - Total Medications: 4
   - Total Reminders: 49
   - System Adherence: 91.8%

2. **All Users**
   - User list
   - Each user's stats
   - Delete users

3. **All Medications**
   - Medications from all users
   - Stock levels
   - Categories

4. **All Reminder Logs**
   - Filter by status
   - User activity
   - Historical data

---

## 💾 Database Tables

### Users Table
```sql
- id (UUID)
- firstName, lastName
- email (unique)
- password (hashed)
- phone, dateOfBirth, address
- role (user/admin)
- isActive
- lastLogin
- createdAt, updatedAt
```

### Medications Table
```sql
- id (UUID)
- userId (FK)
- name, dosage, dosageType
- frequency, timeSchedule (JSON)
- amount, category
- startDate, endDate
- stockLevel
- notes
- isPillboxConnected
- isActive
- createdAt, updatedAt
```

### ReminderLogs Table
```sql
- id (UUID)
- userId (FK)
- medicationId (FK)
- status (taken/missed/snoozed/skipped)
- scheduledTime, takenTime
- date
- notes
- createdAt, updatedAt
```

---

## 🚀 Next Steps

### 1. Start Angular Frontend
```bash
cd "c:\xampp\htdocs\DoseGuard Medication Reminder App"
npm start
# Or: ionic serve
```

### 2. Login in App
- Email: `demo@doseguard.app`
- Password: `demo123`

### 3. Verify You See
- ✅ 4 medications on dashboard
- ⚠️ Low stock alerts
- 📊 Adherence stats
- 📋 Reminder history
- 🎯 Upcoming reminders

### 4. Test Actions
```
• Mark reminder as taken
• Add new medication
• Update profile
• Check adherence trends
```

### 5. Test Admin (Optional)
```
Login as: admin@doseguard.app
Password: admin123
View: System statistics, all users, all medications
```

---

## ✅ Verification Checklist

- ✅ Backend API running on port 3001
- ✅ MySQL database connected
- ✅ doseguard_db created with all tables
- ✅ 2 users created (admin + demo)
- ✅ 4 medications added
- ✅ 49 reminder logs populated
- ✅ All models synced
- ✅ JWT authentication working
- ✅ Password hashing enabled
- ✅ Admin role enforced
- ✅ All 25+ API endpoints active

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| 404 Not Found | Check API endpoint spelling |
| 401 Unauthorized | JWT token missing/expired, login again |
| 403 Forbidden | User role insufficient for endpoint |
| Empty medications | Create via POST /api/medications |
| No reminders | Create via POST /api/reminders/log |

---

## 📞 Support Commands

```bash
# View server logs
npm run dev

# Reset database (deletes all data)
npm run setup

# Create new admin user
npm run create-admin

# Add test data again
node create-test-data.js

# Check health
curl http://localhost:3001/health
```

---

**Last Updated**: April 15, 2026
**Status**: ✅ FULLY OPERATIONAL - READY FOR TESTING
