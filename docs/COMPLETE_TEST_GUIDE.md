# 🎯 Complete Test Accounts Guide

## ✅ System Now Has 3 Complete Test Users

Each user has their OWN medications and reminder history in the database.

---

## 👥 Test Account 1: ADMIN

**Account Details:**
```
📧 Email: admin@doseguard.app
🔑 Password: admin123
👤 Role: Administrator
```

**Access:**
- ✅ View ALL users in system
- ✅ View ALL medications (all users)
- ✅ View ALL reminders (all users)
- ✅ System statistics dashboard
- ✅ Delete user accounts

**Data:**
```
Medications: None (admin account)
Reminders: None (admin account)
Adherence: N/A
```

---

## 👥 Test Account 2: DEMO USER

**Account Details:**
```
📧 Email: demo@doseguard.app
🔑 Password: demo123
👤 Role: Regular User
```

**After Login - You'll See:**

**💊 Dashboard (4 Medications):**
```
1. Aspirin 500mg
   Twice daily (08:00, 20:00)
   Stock: 25 units ✅

2. Metformin 850mg
   Three times daily (07:00, 13:00, 19:00)
   Stock: 45 units ✅

3. Lisinopril 10mg
   Once daily (09:00)
   Stock: 8 units ⚠️ LOW

4. Vitamin D3 2000 IU
   Once daily (12:00)
   Stock: 5 units ⚠️ LOW
```

**📋 Reminder History (7 Days):**
```
Total: 49 reminders
✅ Taken: 45 (91.8%)
❌ Missed: 1
⏱️ Snoozed: 3
📈 Adherence: 91.8%
```

**⚠️ Low Stock Alerts (2):**
```
• Lisinopril - 8 units
• Vitamin D3 - 5 units
```

---

## 👥 Test Account 3: MARIA SANTOS (NEW USER) ← NEWEST! 🆕

**Account Details:**
```
📧 Email: maria@doseguard.app
🔑 Password: maria123
👤 Role: Regular User
```

**User Profile:**
```
Name: Maria Santos
Phone: +63-9175551234
Birthday: May 20, 1985
Address: Manila, Philippines
```

**After Login - You'll See:**

**💊 Dashboard (4 Medications):**
```
1. Losartan 50mg
   Once daily (06:00)
   Stock: 28 units ✅

2. Omeprazole 20mg
   Once daily (07:00)
   Stock: 15 units ✅

3. Atorvastatin 40mg
   Once daily (20:00)
   Stock: 3 units ⚠️ LOW

4. Aspirin 100mg
   Once daily (09:00)
   Stock: 70 units ✅
```

**📋 Reminder History (5 Days):**
```
Total: 20 reminders
✅ Taken: 18 (90.0%)
❌ Missed: 0
⏱️ Snoozed: 2
📈 Adherence: 90.0%
```

**⚠️ Low Stock Alerts (1):**
```
• Atorvastatin - 3 units
```

---

## 🔄 Database Structure (Current State)

```
DATABASE: doseguard_db

USERS TABLE (3 users)
├─ admin@doseguard.app
│  └─ Role: Admin
│     Medications: 0
│     Reminders: 0
│
├─ demo@doseguard.app
│  └─ Role: User
│     Medications: 4 (Aspirin, Metformin, Lisinopril, Vitamin D3)
│     Reminders: 49 (7 days history)
│     Adherence: 91.8%
│
└─ maria@doseguard.app
   └─ Role: User
      Medications: 4 (Losartan, Omeprazole, Atorvastatin, Aspirin)
      Reminders: 20 (5 days history)
      Adherence: 90.0%
```

---

## 🧪 Complete Test Workflow

### Scenario 1: Login as Demo User
```bash
1. Login: demo@doseguard.app / demo123
2. Expected: Dashboard with 4 medications
3. Expected: 49 reminders in history
4. Expected: 91.8% adherence rate
5. Expected: 2 low stock alerts
```

### Scenario 2: Login as Maria (New User)
```bash
1. Login: maria@doseguard.app / maria123
2. Expected: Dashboard with 4 medications (different ones!)
3. Expected: 20 reminders in history
4. Expected: 90.0% adherence rate
5. Expected: 1 low stock alert
```

### Scenario 3: Login as Admin
```bash
1. Login: admin@doseguard.app / admin123
2. Expected: Admin dashboard
3. Expected: Can see all 3 users
4. Expected: Can see all medications (8 total)
5. Expected: Can see all reminders (69 total)
6. Expected: System statistics showing totals
```

---

## 🔌 API Endpoints Now Support Multiple Users

### When You Login as Demo User
```bash
GET /api/medications
→ Returns: 4 medications for Demo User only

GET /api/reminders/logs
→ Returns: 49 reminders for Demo User only

GET /api/reminders/adherence
→ Returns: 91.8% adherence for Demo User
```

### When You Login as Maria
```bash
GET /api/medications
→ Returns: 4 medications for Maria only (different set!)

GET /api/reminders/logs
→ Returns: 20 reminders for Maria only

GET /api/reminders/adherence
→ Returns: 90.0% adherence for Maria
```

### When You Login as Admin
```bash
GET /api/admin/users
→ Returns: All 3 users in system

GET /api/admin/medications
→ Returns: All 8 medications (from all users)

GET /api/admin/reminder-logs
→ Returns: All 69 reminders (from all users)

GET /api/admin/stats/system
→ Returns: {
   "totalUsers": 3,
   "totalMedications": 8,
   "totalReminders": 69,
   "adherenceRate": "91.0%"
}
```

---

## 🎯 What This Proves

✅ **Multiple Users Work:**
- Each user has separate medications
- Each user has separate reminders
- Each user sees only their own data

✅ **Data Isolation:**
- Demo user medications don't show for Maria
- Maria medications don't show for Demo
- Each user's adherence is calculated separately

✅ **Admin Can See Everything:**
- Admin dashboard shows all users
- Admin can view all medications
- Admin can view all reminders
- Admin can manage the system

✅ **Database Relationships:**
- Users → Medications (one-to-many) ✅
- Users → ReminderLogs (one-to-many) ✅
- Medications → ReminderLogs (one-to-many) ✅

---

## 🚀 How to Test Each Account

### Terminal Commands
```bash
# Create Admin User
npm run create-admin

# Create Demo User with Data (7 days)
npm run create-test-user

# Create Maria User with Data (5 days) - ALREADY DONE!
npm run create-new-user

# Start Backend (keep running)
npm run dev
```

### In Browser/App
```
1. Open http://localhost:4200

2. LOGIN TEST #1 - Demo User
   Email: demo@doseguard.app
   Password: demo123
   Expect: 4 meds, 49 reminders, 91.8% adherence

3. LOGOUT and LOGIN TEST #2 - Maria User
   Email: maria@doseguard.app
   Password: maria123
   Expect: 4 meds, 20 reminders, 90.0% adherence

4. LOGOUT and LOGIN TEST #3 - Admin
   Email: admin@doseguard.app
   Password: admin123
   Expect: Admin dashboard, all users, all data
```

---

## 💡 What You're Testing

### With This Setup, You Can Test:

✅ **User Registration**
- Create new users with unique emails

✅ **User Authentication**
- Login/logout with JWT tokens
- Token expiry handling

✅ **Data Isolation**
- Each user sees only their data
- No cross-user data leakage

✅ **Medication Management**
- Create medications
- Display medications
- Edit/delete medications
- Low stock alerts

✅ **Reminder System**
- Log reminders
- View reminder history
- Calculate adherence
- Track pill-taking behavior

✅ **Admin Features**
- View all users
- View all medications
- View all reminders
- System statistics

✅ **Database Relationships**
- User-Medication relationship
- User-ReminderLog relationship
- Medication-ReminderLog relationship

---

## 📊 Database Summary

| Metric | Count |
|--------|-------|
| Total Users | 3 |
| Total Medications | 8 |
| Total Reminders | 69 |
| Overall Adherence | ~91% |

**Breakdown by User:**

| User | Medications | Reminders | Adherence |
|------|-------------|-----------|-----------|
| Admin | 0 | 0 | N/A |
| Demo | 4 | 49 | 91.8% |
| Maria | 4 | 20 | 90.0% |

---

## ✅ Verification Checklist

- ✅ 3 users created with unique data
- ✅ 8 medications assigned to users
- ✅ 69 reminder records in database
- ✅ Each user sees only their data
- ✅ Admin can access all data
- ✅ Adherence calculated per user
- ✅ Low stock alerts working
- ✅ JWT authentication working
- ✅ API endpoints responding correctly
- ✅ Database relationships intact

---

## 🎊 You're Ready to Test!

**All user scenarios covered:**
1. ✅ Regular User (Demo)
2. ✅ New User (Maria)
3. ✅ Admin User
4. ✅ Multiple Users
5. ✅ Data Isolation
6. ✅ Full Dataset

**Just login with any of these 3 accounts and start testing!** 🚀

---

**Status**: ✅ FULLY OPERATIONAL WITH 3 TEST USERS
**Last Updated**: April 15, 2026
