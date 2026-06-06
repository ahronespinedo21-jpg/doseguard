# DoseGuard Signup & Database Integration - Setup Guide

## ✅ What Was Fixed

Your signup flow is now **fully integrated with the backend database**. Here's what was changed:

### 1. **Frontend (Angular) Changes**
- **File Modified**: `src/app/services/auth.service.ts`
  - Updated `signup()` method to call the **real backend API** at `http://localhost:3001/api/auth/register`
  - Updated `login()` method to call the **real backend API** at `http://localhost:3001/api/auth/login`
  - Updated `adminLogin()` method to verify admin role from backend
  - Added HttpClient import to make HTTP requests

- **File Modified**: `src/app/pages/signup/signup.component.ts`
  - Improved error handling and validation messages

### 2. **Backend Configuration**
- **File Modified**: `backend/.env`
  - Updated CORS_ORIGIN to accept both `http://localhost:8100` (Ionic) and `http://localhost:4200` (Angular)
  - API now properly accepts requests from your frontend on port 8100

### 3. **How It Works Now**
```
User fills signup form
    ↓
Clicks "Create Account"
    ↓
Frontend validates form
    ↓
Sends POST request to http://localhost:3001/api/auth/register
    ↓
Backend receives data and saves to MySQL database
    ↓
Backend returns success response with JWT token
    ↓
Frontend automatically redirects to Login page
    ↓
User can then login with their new credentials
```

## 🚀 How to Use It

### Step 1: Start MySQL (XAMPP)
```bash
# Open XAMPP Control Panel and start MySQL
# Or if using dedicated MySQL, make sure it's running
```

### Step 2: Setup Backend Database
```bash
cd backend
npm install          # Install dependencies if not done
npm run setup        # Initialize database with tables
```

### Step 3: Start Backend Server
```bash
cd backend
npm run dev          # Runs on http://localhost:3001
```
You should see: **Server is running on port 3001**

### Step 4: Start Frontend (in new terminal)
```bash
cd "DoseGuard Medication Reminder App"
npm run ionic        # Runs on http://localhost:8100
```

## 📊 Verify Data in Database

After signup, you can verify the user was saved in your database:

### Using PHPMyAdmin (XAMPP)
1. Go to `http://localhost/phpmyadmin`
2. Select database: **doseguard_db**
3. Select table: **users**
4. You'll see the user data (firstName, lastName, email, password - encrypted)

### Using Terminal/Command Line
```bash
# Connect to MySQL
mysql -u root
use doseguard_db;
SELECT * FROM users;
```

## 🔍 Testing the Flow

1. **Open Frontend**: `http://localhost:8100`
2. **Click "Create Account"** or go to signup page
3. **Fill in the form**:
   - First Name: John
   - Last Name: Doe
   - Email: john@example.com
   - Password: password123

4. **Click "Create Account"**
   - You should see "Account created successfully! 🎉"
   - Redirects to login page automatically

5. **Verify in Database**:
   - Open PHPMyAdmin
   - Check **doseguard_db > users** table
   - Your user data is there! ✅

6. **Login with the account**:
   - Email: john@example.com
   - Password: password123
   - Should redirect to dashboard

## ⚡ What's Working Now
- ✅ Signup saves data to MySQL database
- ✅ Auto-redirect to login after signup
- ✅ Login pulls data from database
- ✅ Password validation
- ✅ Email uniqueness check (prevents duplicate emails)
- ✅ JWT token generation for security
- ✅ Admin login functionality
- ✅ CORS configured properly

## 🐛 If You Get Errors

### Error: "Cannot POST /api/auth/register"
- Make sure backend is running (`npm run dev`)
- Check if backend is on port 3001

### Error: "CORS error" or "blocked by CORS"
- Backend .env file was updated with correct CORS_ORIGIN
- Restart backend server after .env change

### Error: "Cannot connect to database"
- Make sure MySQL is running in XAMPP
- Check .env file has correct DB settings
- Run `npm run setup` to create database

### Error: "Email already registered"
- Use a different email for signup
- Or delete the user from database and try again

## 📝 Notes
- Passwords are **encrypted** in database (bcryptjs)
- Users are stored in `doseguard_db.users` table
- Each signup gets a unique user ID, role='user'
- Admins can be created with `npm run create-admin` in backend

---

**You're all set! 🎉** Your signup flow is now fully connected to the MySQL database through the backend API.
