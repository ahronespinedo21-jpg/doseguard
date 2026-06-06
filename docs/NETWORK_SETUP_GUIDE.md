# 🌐 DoseGuard Multi-Device Networking Setup Guide

**Last Updated:** April 18, 2026  
**Setup Status:** ✅ FULLY CONFIGURED

---

## 📍 Your Network Configuration

### Machine Details
- **Operating System:** Windows 11
- **Local IP Address:** `10.0.0.215`
- **Network Adapter:** Wi-Fi 28
- **Subnet Mask:** 255.255.240.0
- **Gateway:** 10.0.0.1

### Backend Server Details
- **Port:** 3001
- **Binding:** 0.0.0.0 (All network interfaces)
- **Status:** Running
- **Database:** MySQL (doseguard_db)

---

## 🚀 Connection URLs

### For Laptop/Desktop (localhost)
```
http://localhost:3001
```

### For Mobile/LAN Devices (Required for phone WebNative)
```
http://10.0.0.215:3001
```

### API Endpoints

#### Health & Status
- **Health Check:** `http://10.0.0.215:3001/health`
- **Status:** `http://10.0.0.215:3001/status`

#### API Routes
- **Base URL:** `http://10.0.0.215:3001/api`
- **Auth:** `http://10.0.0.215:3001/api/auth`
  - POST `/register` - Create account
  - POST `/login` - Login
  - GET `/verify-token` - Verify JWT token
- **User:** `http://10.0.0.215:3001/api/user`
  - GET `/profile` - Get user profile
  - PUT `/profile` - Update profile
- **Medications:** `http://10.0.0.215:3001/api/medications`
  - GET / - List all medications
  - POST / - Add medication
  - PUT /:id - Update medication
  - DELETE /:id - Delete medication
- **Reminders:** `http://10.0.0.215:3001/api/reminders`
- **Admin:** `http://10.0.0.215:3001/api/admin`

---

## 📱 WebNative Setup Instructions

### Step 1: Update Frontend Configuration
The app automatically detects your IP address. No manual configuration needed!

The `ApiConfigService` will:
1. ✅ Detect when running on LAN IP (10.0.0.215)
2. ✅ Automatically use correct API endpoint
3. ✅ Fall back to localhost if needed
4. ✅ Work on both web preview and mobile WebNative

### Step 2: Test Backend Connection
Open in browser or WebNative preview:
```
http://10.0.0.215:3001/status
```

Expected Response:
```json
{
  "success": true,
  "status": "online",
  "message": "DoseGuard Backend is operational",
  "server": "DoseGuard Backend API v1.0",
  "timestamp": "2026-04-18T...",
  "uptime": 120.5,
  "environment": "development",
  "endpoints": {
    "auth": "/api/auth",
    "user": "/api/user",
    "medications": "/api/medications",
    "reminders": "/api/reminders",
    "admin": "/api/admin"
  }
}
```

### Step 3: Start the App

#### On Laptop (Localhost)
```bash
cd "c:\xampp\htdocs\DoseGuard Medication Reminder App"
ng serve --host localhost --port 4200
```
Access at: `http://localhost:4200`

#### On Phone/Mobile Device (WebNative)
```bash
cd "c:\xampp\htdocs\DoseGuard Medication Reminder App"
ionic serve --host 10.0.0.215 --port 8100
```
Access at: `http://10.0.0.215:8100`

---

## 🔧 Backend Server Commands

### Start Backend
```bash
cd "c:\xampp\htdocs\DoseGuard Medication Reminder App\backend"
npm start
```

### Development Mode (with auto-reload)
```bash
npm run dev
```

### View Logs
The server logs show:
- Request timestamps
- HTTP methods and paths
- Database connection status
- Uptime information

---

## 🛡️ CORS Configuration

The backend is configured to accept requests from:
- ✅ Localhost (127.0.0.1, localhost)
- ✅ LAN IPs (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
- ✅ Mobile apps (no origin header)
- ✅ All development origins

**Note:** In production, restrict CORS to specific origins.

---

## 🗄️ Database Configuration

### MySQL Details
- **Host:** localhost
- **Port:** 3306
- **User:** root
- **Password:** (empty)
- **Database:** doseguard_db
- **Status:** ✅ Running

### Tables
- `Users` - User accounts and authentication
- `Medications` - Medication records
- `ReminderLogs` - Reminder history
- `Reminders` - Scheduled reminders

### Verify Connection
```bash
# From command line
mysql -u root -p "" doseguard_db

# Or using MySQL workbench
Host: localhost
Port: 3306
Username: root
Password: (empty)
Database: doseguard_db
```

---

## 📱 Mobile WebNative Testing

### Chrome DevTools (Mobile Emulation)
1. Open `http://10.0.0.215:8100` in Chrome
2. Press F12 to open DevTools
3. Press Ctrl+Shift+M to enable device emulation
4. Test all features as if on real phone

### Real Mobile Device
1. **Ensure same Wi-Fi network:** Both laptop and phone on Wi-Fi 28
2. **Use LAN IP:** Open `http://10.0.0.215:8100` on mobile
3. **Not localhost:** ❌ `http://localhost:8100` will NOT work
4. **Check firewall:** Allow port 3001 and 8100 through Windows firewall

---

## 🚨 Troubleshooting

### Backend Not Reachable from Phone
**Problem:** `http://10.0.0.215:3001` doesn't respond  
**Solution:**
1. Verify phone is on same Wi-Fi network
2. Confirm backend is running: `npm start` in backend folder
3. Check Windows Firewall allows port 3001
4. Verify IP: Run `ipconfig` on Windows
5. Test locally first: `http://localhost:3001/status`

### App Can't Connect to API
**Problem:** API calls fail from WebNative  
**Solution:**
1. Open browser DevTools (F12)
2. Check Console for errors
3. Check Network tab for API requests
4. Verify backend is running
5. Check that ApiConfigService has correct IP

### Database Connection Error
**Problem:** "Unable to connect to database"  
**Solution:**
1. Start MySQL: Open XAMPP Control Panel → MySQL → Start
2. Verify XAMPP is running: Check system tray
3. Confirm doseguard_db exists: Run `mysql -u root -p "" -e "SHOW DATABASES;"`
4. Check .env file: DB_HOST, DB_USER, DB_PASSWORD

### CORS Error
**Problem:** "Access to XMLHttpRequest blocked by CORS policy"  
**Solution:**
1. Backend is configured to accept all LAN origins
2. Check browser console for exact origin that's blocked
3. Restart backend server: Stop and run `npm start` again
4. Clear browser cache: Ctrl+Shift+Delete

---

## 🔄 Service Restart Checklist

When restarting services, follow this order:

1. **MySQL** - Start first (if not running)
   - XAMPP Control Panel → MySQL → Start

2. **Backend** - Start second
   ```bash
   npm start
   ```
   
3. **Frontend** - Start third
   ```bash
   ng serve     # or
   ionic serve
   ```

4. **Browser** - Refresh last
   - F5 or Ctrl+R

---

## 📊 Network Diagram

```
┌─────────────────────────────────────────┐
│         Wi-Fi Network (10.0.0.x)        │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │   Windows PC (10.0.0.215)        │  │
│  │                                  │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │  Backend (Node.js)         │  │  │
│  │  │  Port 3001                 │  │  │
│  │  │  Binding: 0.0.0.0          │  │  │
│  │  └────────┬───────────────────┘  │  │
│  │           │                      │  │
│  │  ┌────────▼────────────────────┐ │  │
│  │  │  MySQL Database             │ │  │
│  │  │  localhost:3306             │ │  │
│  │  │  doseguard_db               │ │  │
│  │  └─────────────────────────────┘ │  │
│  │                                  │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │  Frontend (Web/Ionic)      │  │  │
│  │  │  localhost:4200            │  │  │
│  │  │  or 10.0.0.215:8100        │  │  │
│  │  └────────────────────────────┘  │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │   Mobile Phone (e.g. 10.0.0.100) │  │
│  │   WebNative App                  │  │
│  │   Connects to:                   │  │
│  │   http://10.0.0.215:3001/api     │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │   Laptop/Tablet                  │  │
│  │   Web Browser                    │  │
│  │   Connects to:                   │  │
│  │   http://10.0.0.215:8100         │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## ✅ Verification Checklist

Run this checklist after setup to ensure everything works:

- [ ] MySQL running (XAMPP Control Panel)
- [ ] Backend running (`npm start` shows "DoseGuard API Server running")
- [ ] Frontend accessible (`http://localhost:4200` or `http://10.0.0.215:8100`)
- [ ] Health check passes (`http://10.0.0.215:3001/health` returns 200)
- [ ] Status check passes (`http://10.0.0.215:3001/status` returns JSON)
- [ ] Can register new account (signup form works)
- [ ] Can login with account (login page works)
- [ ] Can see medications (API returns data)
- [ ] Can add medication (POST /api/medications works)
- [ ] Phone can reach `http://10.0.0.215:3001/health`
- [ ] Phone can load app at `http://10.0.0.215:8100`
- [ ] Browser console has no CORS errors
- [ ] Database tables populated with test data

---

## 🎯 One-Click Quick Start

Save this script as `start-all.bat` in the project root:

```batch
@echo off
echo Starting DoseGuard Full Stack...

REM Start MySQL
echo Starting MySQL...
if exist "C:\xampp\mysql\bin\mysqld.exe" (
    tasklist | find /I "mysqld" >nul
    if errorlevel 1 (
        start "MySQL" "C:\xampp\mysql\bin\mysqld.exe" --basedir="C:\xampp\mysql" --datadir="C:\xampp\mysql\data"
    )
)

REM Start Backend
echo Starting Backend...
cd backend
start "Backend" cmd /k npm start

REM Start Frontend
echo Starting Frontend...
cd ..
start "Frontend" cmd /k ng serve --host 0.0.0.0 --port 4200

echo.
echo ========================================
echo All services started!
echo ========================================
echo Localhost:  http://localhost:4200
echo LAN IP:     http://10.0.0.215:8100
echo Backend:    http://10.0.0.215:3001
echo Status:     http://10.0.0.215:3001/status
echo ========================================
```

Run with: `start-all.bat`

---

## 📞 Support

For connection issues:
1. Check backend logs (`npm start` output)
2. Open browser DevTools (F12)
3. Check Console and Network tabs
4. Verify IP with `ipconfig`
5. Verify ports with `netstat -an | findstr "3001\|8100"`

---

**Last Updated:** April 18, 2026  
**Status:** ✅ Production Ready for LAN  
**Next Steps:** Test on mobile device and configure mobile notifications
