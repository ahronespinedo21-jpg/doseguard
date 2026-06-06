# Quick Start Guide - DoseGuard Backend

## ✅ Prerequisites Checklist

Before starting, make sure you have:
- [ ] Node.js installed (`node --version` in terminal)
- [ ] XAMPP running (MySQL service active)
- [ ] Terminal/Command Prompt open
- [ ] Located in backend folder

---

## 🚀 Setup Steps

### Step 1: Install Dependencies
```bash
cd backend
npm install
```
This downloads all required packages (Express, MySQL, Sequelize, etc.)

**Expected output:** `added XXX packages`

---

### Step 2: Setup Database
```bash
npm run setup
```

This will:
- Connect to MySQL
- Create `doseguard_db` database
- Create User, Medication, ReminderLog tables
- Setup relationships

**Expected output:**
```
✅ Connected to MySQL
✅ Database 'doseguard_db' created/verified
✅ Database models synchronized
🎉 Setup Complete!
```

**If you see errors:**
- ❌ "Unable to connect" → Start XAMPP MySQL
- ❌ "Access denied" → Check MySQL root password in .env

---

### Step 3: Start Server
```bash
npm run dev
```

**Expected output:**
```
✅ Database synchronized successfully!

🚀 DoseGuard API Server running on http://localhost:3001
📚 API Documentation: http://localhost:3001/api
💊 Check health: http://localhost:3001/health
```

---

## ✔️ Verify Setup

Open in browser or use curl:

```bash
curl http://localhost:3001/health
```

**Expected response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

---

## 🧪 Test with Sample Request

### Register a Test User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "password": "test123"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "role": "user"
  }
}
```

---

## 🎛️ Environment Configuration

File: `.env`

Key variables:
- `DB_HOST=localhost` - MySQL server
- `DB_USER=root` - MySQL username
- `DB_PASSWORD=` - MySQL password (empty for XAMPP default)
- `PORT=3001` - API server port
- `JWT_SECRET=...` - Token signing key

*Change these for production!*

---

## 💾 Database Management

### View Tables in phpMyAdmin
1. Open http://localhost/phpmyadmin
2. Login (default: user=root, no password)
3. Select `doseguard_db` database
4. View `Users`, `Medications`, `ReminderLogs` tables

### Reset Database
```bash
npm run setup
```
This drops and recreates all tables

### Export Database
```sql
# In phpMyAdmin or MySQL CLI
mysqldump -u root doseguard_db > backup.sql
```

---

## 🔌 Available Endpoints

### Public Endpoints (No Auth Required)
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /health` - Health check

### Protected Endpoints (Requires JWT Token)
- `GET /api/user/profile` - User profile
- `POST /api/medications` - Add medication
- `GET /api/medications` - List medications
- `POST /api/reminders/log` - Log reminder
- `GET /api/reminders/adherence` - Adherence stats

### Admin Endpoints
- `GET /api/admin/users` - All users
- `GET /api/admin/stats/system` - System stats

*See API_DOCUMENTATION.md for full endpoint list*

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| ECONNREFUSED on port 3306 | Start XAMPP MySQL service |
| EACCES permission denied | Run terminal as administrator |
| Port 3001 already in use | Change PORT in .env or kill process |
| Cannot find module 'express' | Run `npm install` |
| Database table doesn't exist | Run `npm run setup` |

---

## 🎯 Next Steps

1. ✅ Backend running on http://localhost:3001
2. Test API endpoints using Postman or curl
3. Connect Angular frontend to backend API
4. Create admin user (manually in database or via API)
5. Test complete user flow

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| server.js | Main API server |
| .env | Configuration |
| models/ | Database models |
| controllers/ | Business logic |
| routes/ | API endpoints |
| config/database.js | DB connection |

---

## 📚 Documentation

- **README.md** - Project overview & features
- **API_DOCUMENTATION.md** - All endpoints & responses
- **This file** - Quick setup guide

---

## 🚀 Production Deployment

Before deploying to production:
- [ ] Change `JWT_SECRET` to strong random value
- [ ] Use real MySQL server (not localhost)
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS
- [ ] Configure CORS_ORIGIN properly
- [ ] Setup database backups
- [ ] Use environment variables securely

---

## 💡 Tips

- Use `npm run dev` during development (auto-restarts on file changes)
- Use `npm start` in production
- Check server console for request logs
- Token expires in 7 days (configurable)
- Password automatically hashed using bcryptjs

---

**Ready to start?** Run: `npm run dev`
