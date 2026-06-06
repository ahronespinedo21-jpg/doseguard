# DoseGuard Backend API

Backend REST API for DoseGuard: A Daily Dose Reminder application built with Node.js, Express, and MySQL.

## 🎯 Features

- **User Authentication**: JWT-based authentication with secure password hashing
- **Medication Management**: Create, read, update, delete medications with dosage tracking
- **Reminder System**: Log medication reminders with status tracking (taken, missed, snoozed, skipped)
- **Adherence Tracking**: Monitor medication adherence rates and patterns
- **Admin Dashboard**: System-wide statistics and user management
- **Stock Management**: Low stock alerts for medications

## 📋 Prerequisites

- **Node.js** v14+ ([Download](https://nodejs.org/))
- **MySQL** (via XAMPP or standalone)
- **npm** (included with Node.js)

## 🚀 Quick Start

### Option 1: One-Click Setup (Recommended)
```bash
cd backend
INSTALL.bat
```

### Option 2: Manual Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment**
   - Copy `.env` file (already created with defaults)
   - Update database credentials if needed

3. **Setup Database**
   ```bash
   npm run setup
   ```

4. **Start Server**
   ```bash
   npm run dev
   ```

Server will start at: `http://localhost:3001`

## 📁 Project Structure

```
backend/
├── config/
│   └── database.js          # Sequelize configuration
├── controllers/
│   ├── authController.js    # Authentication endpoints
│   ├── userController.js    # User profile management
│   ├── medicationController.js
│   ├── reminderController.js
│   └── adminController.js
├── models/
│   ├── User.js              # User model with password hashing
│   ├── Medication.js        # Medication model
│   ├── ReminderLog.js       # Reminder logging
│   └── index.js             # Model associations
├── middleware/
│   ├── auth.js              # JWT verification
│   └── admin.js             # Admin role enforcement
├── routes/
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── medicationRoutes.js
│   ├── reminderRoutes.js
│   └── adminRoutes.js
├── server.js                # Main Express app
├── setup.js                 # Database initialization
├── .env                     # Environment variables
├── package.json             # Dependencies
└── INSTALL.bat              # One-click installer
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify-token` - Verify JWT token

### User Profile
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `POST /api/user/change-password` - Change password
- `DELETE /api/user/account` - Delete account

### Medications
- `POST /api/medications` - Create medication
- `GET /api/medications` - Get all medications
- `GET /api/medications/:id` - Get medication details
- `PUT /api/medications/:id` - Update medication
- `DELETE /api/medications/:id` - Delete medication
- `GET /api/medications/low-stock` - Get low stock alerts

### Reminders
- `POST /api/reminders/log` - Log reminder status
- `GET /api/reminders/logs` - Get reminder logs
- `GET /api/reminders/adherence` - Get adherence statistics
- `GET /api/reminders/today` - Get today's reminders

### Admin
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:userId` - Get user details
- `DELETE /api/admin/users/:userId` - Delete user
- `GET /api/admin/medications` - List all medications
- `GET /api/admin/reminder-logs` - List all reminder logs
- `GET /api/admin/stats/system` - System statistics

## 🔐 Authentication

API uses JWT (JSON Web Tokens) for authentication.

**To authenticate requests:**
1. Login with `POST /api/auth/login`
2. Receive JWT token in response
3. Include token in request headers:
   ```
   Authorization: Bearer <your_jwt_token>
   ```

**Token Expiry**: 7 days (configurable in `.env`)

## 📊 Database Schema

### Users Table
- Stores user accounts with encrypted passwords
- Roles: `user` or `admin`
- Auto-timestamps created_at, updated_at

### Medications Table
- Stores medication information
- Tracks stock levels and schedules
- References User through userId

### ReminderLogs Table
- Logs reminder events (taken, missed, snoozed, skipped)
- Tracks both scheduled and actual times
- References User and Medication

## 🛠️ Environment Variables

```
DB_HOST=localhost          # MySQL host
DB_PORT=3306              # MySQL port
DB_USER=root              # MySQL username
DB_PASSWORD=              # MySQL password (empty for default XAMPP)
DB_NAME=doseguard_db      # Database name
PORT=3001                 # Server port
NODE_ENV=development      # Environment
JWT_SECRET=...            # JWT signing secret
JWT_EXPIRE=7d            # Token expiration
CORS_ORIGIN=http://localhost:4200  # Allowed CORS origin
```

## 🧪 Testing Endpoints

### Example: Register User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "secure123"
  }'
```

### Example: Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "secure123"
  }'
```

## 📝 Scripts

```bash
npm start              # Start production server
npm run dev            # Start development server (with nodemon)
npm run setup          # Initialize/reset database
```

## 🐛 Troubleshooting

### MySQL Connection Error
- Ensure XAMPP MySQL is running
- Check credentials in `.env`
- Verify MySQL is on localhost:3306

### Database Already Exists
- Already synced; no action needed
- To reset: Delete database and run `npm run setup` again

### Port Already in Use
- Change PORT in `.env`
- Or kill process on port 3001

## 🔄 Database Reset

To completely reset the database:
```bash
1. npm run setup     # Drops and recreates tables
```

## 📚 Integration with Frontend

Frontend (Angular app) should:
1. Use API base URL: `http://localhost:3001`
2. Store JWT tokens from login response
3. Include Authorization header on all requests
4. Handle token refresh before expiry (optional)

## 🚀 Production Deployment

Before deploying:
1. Change `JWT_SECRET` to strong random value
2. Use real MySQL server (not localhost)
3. Set `NODE_ENV=production`
4. Enable HTTPS
5. Configure appropriate `CORS_ORIGIN`
6. Use environment-specific `.env` files
7. Enable database backups

## 📞 Support

For issues or questions, check:
- Server logs for error messages
- `.env` configuration
- MySQL connection status
- Database synchronization status
