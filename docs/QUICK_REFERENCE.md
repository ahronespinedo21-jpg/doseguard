# Quick Reference - What You'll See

## 🔓 Login Credentials

### Option 1: Regular User (Test Account)
```
📧 Email: demo@doseguard.app
🔑 Password: demo123
👤 Type: Regular User
```

### Option 2: Admin User (System Admin)
```
📧 Email: admin@doseguard.app
🔑 Password: admin123
👤 Type: Administrator
```

---

## 📱 What Regular User Sees

### Dashboard
- **4 Medications** displayed as cards/list
- **Medication Card Info**:
  - Name (Aspirin, Metformin, Lisinopril, Vitamin D3)
  - Dosage (500mg, 850mg, 10mg, 2000 IU)
  - Frequency (Once/Twice/Three times daily)
  - Stock Level (25, 45, 8, 5 units)
  - ⚠️ **2 Low Stock Badges** (Lisinopril & Vitamin D3)

### Low Stock Alerts
- Shows **2 medications**:
  - Lisinopril (8 units left)
  - Vitamin D3 (5 units left)
- Quick action buttons to refill

### Upcoming Reminders Today
- **7 reminders** scheduled for today
- Times: 07:00, 08:00, 09:00, 12:00, 13:00, 19:00, 20:00
- Input fields to mark as ✅ Taken or ❌ Missed
- Quick notes feature

### Adherence Statistics
- **91.8%** adherence rate (high 📈)
- **49** total reminders logged
- **45** taken, **1** missed, **3** snoozed
- 7-day trend view
- Performance badges/stars

### Profile
- Update name, phone, email
- Change password option
- Account deletion option

---

## 👨‍💼 What Admin Sees (All of Above PLUS)

### System Dashboard
- **Total Users**: 2
- **Total Medications**: 4
- **Total Reminders**: 49
- **System Adherence**: 91.8%

### User Management
- List all registered users
- Click to see individual user stats
- Delete user accounts

### Medication Monitoring
- View all medications from all users
- Filter by category
- Track stock levels

### Reminder Reports
- View all reminder logs from all users
- Filter by status (taken/missed/snoozed)
- Historical analysis

---

## 🔌 Database Contents Summary

```
Database: doseguard_db

USERS TABLE
├─ admin@doseguard.app (Role: admin)
└─ demo@doseguard.app (Role: user)

MEDICATIONS TABLE (4 items)
├─ Aspirin 500mg - 25 units
├─ Metformin 850mg - 45 units
├─ Lisinopril 10mg - 8 units ⚠️
└─ Vitamin D3 2000 IU - 5 units ⚠️

REMINDER_LOGS TABLE (49 items)
├─ 45 "taken"
├─ 1 "missed"
└─ 3 "snoozed"
```

---

## 🚀 Quick Start Commands

```bash
# Start Backend (if not running)
cd backend
npm run dev
# Runs on: http://localhost:3001

# Start Frontend
npm start
# Runs on: http://localhost:4200

# Open App in Browser
http://localhost:4200

# Login with
demo@doseguard.app / demo123
```

---

## 📊 Numbers to Expect

| Item | Count |
|------|-------|
| Users | 2 |
| Medications | 4 |
| Reminder Logs | 49 |
| Adherence Rate | 91.8% |
| Low Stock Items | 2 |
| Reminders Today | 7 |
| Days of History | 7 |

---

## ✅ Features You Can Test

**User Features:**
- ✅ Login with email/password
- ✅ View 4 medications
- ✅ See medication details
- ✅ View low stock alerts
- ✅ See today's reminders
- ✅ Mark reminders as taken
- ✅ View adherence statistics
- ✅ Update profile
- ✅ Change password

**Admin Features:**
- ✅ Login as admin
- ✅ View all users
- ✅ View all medications
- ✅ View all reminders
- ✅ See system statistics
- ✅ Manage users
- ✅ View adherence trends

---

## 🎯 Test Workflow

1. **Login** as demo@doseguard.app / demo123
2. **See Dashboard** with 4 medications
3. **Notice** 2 low stock alerts  
4. **Check** Upcoming Reminders (7 today)
5. **Mark** some as taken
6. **View** Adherence Stats (91.8%)
7. **Update** Your Profile
8. **Logout** and login as admin
9. **Check** Admin Dashboard
10. **View** System Statistics

---

## 🆘 If Something Looks Wrong

**No medications showing?**
→ Check database: `npm run create-test-data`

**Can't login?**
→ Check credentials: demo@doseguard.app / demo123

**Backend not responding?**
→ Start backend: `npm run dev`

**Empty low stock alerts?**
→ Normal - only 2 items are low stock

**No reminder history?**
→ Check database: `npm run create-test-data`

---

## 🎊 You're All Set!

Everything is ready. Just:

1. Keep backend running (`npm run dev`)
2. Start frontend (`npm start`)
3. Login with `demo@doseguard.app / demo123`
4. Explore the app with real data!

**Status**: ✅ FULLY OPERATIONAL
