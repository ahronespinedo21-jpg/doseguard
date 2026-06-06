# Admin Scripts

This directory contains utility scripts for managing user accounts in the DoseGuard application.

## Available Scripts

### 1. Test Admin Login
Tests if the admin account exists and if the password is correct.

**Usage:**
```bash
node scripts/testAdminLogin.js
```

This will:
- Check if admin@doseguard.com exists in the database
- Verify the password is correctly hashed
- Test password comparison
- Report if login should work

### 2. Create Admin Account
Creates a default admin account if one doesn't exist.

**Usage:**
```bash
node scripts/createAdmin.js
```

**Default Credentials:**
- Email: `admin@doseguard.com`
- Password: `admin123`

**⚠️ Important:** Change the password after first login!

### 3. List All Users
Lists all users in the database with their details.

**Usage:**
```bash
node scripts/listUsers.js
```

This will show:
- User ID
- Name
- Email
- Role (user/admin)
- Active status
- Last login date
- Creation date

### 4. Reset User Password
Resets the password for a specific user.

**Usage:**
```bash
node scripts/resetPassword.js <email> [new_password]
```

**Examples:**
```bash
# Reset to default password (admin123)
node scripts/resetPassword.js admin@doseguard.com

# Reset to a custom password
node scripts/resetPassword.js admin@doseguard.com mynewpassword123
```

## Quick Start Guide

If you're having login issues, follow these steps:

1. **Test the admin account:**
   ```bash
   node scripts/testAdminLogin.js
   ```

2. **If admin doesn't exist, create it:**
   ```bash
   node scripts/createAdmin.js
   ```

3. **If password is wrong, reset it:**
   ```bash
   node scripts/resetPassword.js admin@doseguard.com
   ```

4. **Make sure backend server is running:**
   ```bash
   cd backend && npm start
   ```

5. **Login with:**
   - Email: admin@doseguard.com
   - Password: admin123

## Troubleshooting

### "Invalid Credentials" Error

If you're getting an "Invalid credentials" error:

1. **Check if the user exists:**
   ```bash
   node scripts/listUsers.js
   ```

2. **If no users exist, create an admin:**
   ```bash
   node scripts/createAdmin.js
   ```

3. **If user exists but password is wrong, reset it:**
   ```bash
   node scripts/resetPassword.js <user_email>
   ```

4. **Check the backend logs for detailed error messages:**
   - Look for `🔐 Login attempt` logs
   - Check if user is found
   - Check if password matches

### Database Connection Issues

If you get database connection errors:

1. Make sure the backend server is running
2. Check your `.env` file for correct database credentials
3. Ensure MySQL/MariaDB is running

## Security Notes

- Always change default passwords after first login
- Don't share admin credentials
- Use strong passwords (minimum 8 characters, mix of letters, numbers, and symbols)
- Regularly review user accounts and remove inactive users

## Common Issues

### Email Case Sensitivity
The login system is case-insensitive for email matching. However, it's best practice to use lowercase emails.

### Password Hashing
All passwords are automatically hashed using bcrypt before storage. You don't need to hash passwords manually.

### User Roles
- `user`: Regular user with basic access
- `admin`: Administrator with full access to all features

### Active Status
Users with `isActive: false` cannot log in even with correct credentials. Use the listUsers script to check active status.
