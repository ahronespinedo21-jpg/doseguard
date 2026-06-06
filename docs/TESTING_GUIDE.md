# DoseGuard System Testing Guide

## Quick Start

### 1. Ensure Backend is Running
```bash
# In backend terminal
npm start
# Should see: ✅ DoseGuard Backend running on port 3001
```

### 2. Start Frontend
```bash
# In DoseGuard root directory
npm start
# Should open http://localhost:4200 automatically
```

## Test Scenarios

### Scenario 1: User Login
1. Click "Sign In" on login page
2. Enter credentials:
   - Email: `demo@doseguard.app`
   - Password: `demo123`
3. Click "Sign In"
4. **Expected Result**:
   - ✅ Redirect to dashboard
   - ✅ User data visible
   - ✅ Token stored in localStorage
   - ✅ Console shows: `✅ Login successful`

**Debugging**:
- Check Network tab: POST to `/api/auth/login` should return 200
- Check localStorage: `doseguard_token` should exist
- Check console: Look for green "✅ Login successful" message

### Scenario 2: User Signup
1. Click "Sign up" on login page
2. Fill registration form:
   - First Name: `Test`
   - Last Name: `User`
   - Email: `testuser@example.com`
   - Password: `test123456` (min 6 chars)
3. Click "Sign Up"
4. **Expected Result**:
   - ✅ New user created in MySQL
   - ✅ Redirect to dashboard
   - ✅ Token stored
   - ✅ Can use new account to login

**Debugging**:
- Check Network: POST to `/api/auth/register` should return 200
- Check MySQL: `SELECT * FROM users WHERE email = 'testuser@example.com'`
- Check server logs: Should show `📝 USER REGISTERED` message

### Scenario 3: Admin Login
1. Click "Administrator Access" button on login page
2. Enter admin credentials:
   - Email: `admin@doseguard.app`
   - Password: `admin123`
3. Click "Access Admin Panel"
4. **Expected Result**:
   - ✅ Redirect to /admin page
   - ✅ Admin token stored
   - ✅ Can access admin features
   - ✅ Cannot login as admin with user email

**Debugging**:
- Check Network: POST to `/api/auth/login` followed by role validation
- Try with `demo@doseguard.app`: Should fail with "only admins" error
- Check console: Look for admin-specific logs

### Scenario 4: View Medications
1. Login as `demo@doseguard.app`
2. Navigate to Dashboard
3. **Expected Result**:
   - ✅ See list of medications for that user
   - ✅ Show medication names, dosages, frequencies
   - ✅ Show medication details from MySQL

**Debugging**:
- Network tab: GET `/api/medications` should return array of medications
- Check MySQL: `SELECT * FROM medications WHERE userId = <user_id>`
- Console: Should show medications loaded message

### Scenario 5: Log Reminder
1. Dashboard shows today's reminders
2. Click "Take" on any reminder
3. **Expected Result**:
   - ✅ Reminder status updated to "taken"
   - ✅ Time recorded
   - ✅ Data saved to MySQL

**Debugging**:
- Network: POST to `/api/reminders/log` with status="taken"
- MySQL: Check `reminder_logs` table for new entry with status="taken"

### Scenario 6: View Low Stock
1. Navigate to "Low Stock" page
2. **Expected Result**:
   - ✅ Show only medications with stock < threshold
   - ✅ Display warning colors
   - ✅ Pull from API, not mock data

**Debugging**:
- Network: GET to `/api/medications/low-stock`
- MySQL: Check which medications have low stock levels

### Scenario 7: View Adherence Stats
1. Dashboard or settings page shows adherence
2. **Expected Result**:
   - ✅ Show percentage calculations
   - ✅ Based on actual reminder logs
   - ✅ Updated data from API

**Debugging**:
- Network: GET to `/api/reminders/adherence`
- Calculate manually: total_taken / total_scheduled * 100

## Database Verification

### Check User
```sql
SELECT * FROM users WHERE email = 'demo@doseguard.app';
-- Should show: Demo User, role='user'
```

### Check User's Medications
```sql
SELECT * FROM medications WHERE userId = <user_id>;
-- Should show 4 medications for demo user
```

### Check Reminder Logs
```sql
SELECT * FROM reminder_logs WHERE userId = <user_id>;
-- Should show all logged reminders for this user
```

### Check All Users
```sql
SELECT id, firstName, lastName, email, role, createdAt FROM users;
-- Should show 3 users: admin, demo, maria
```

## Token Verification

### Check Token in Browser
1. Open DevTools (F12)
2. Go to "Application" tab
3. Click "Local Storage"
4. Click "http://localhost:4200"
5. Look for `doseguard_token`
   - Should be a long string (JWT format with 3 dots)
   - Format: `header.payload.signature`

### Decode Token (Optional)
Visit https://jwt.io and paste the token to see:
- User ID
- Email
- Expiration time (exp)
- Issue time (iat)

### Manual Token Test
```bash
# Get a token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@doseguard.app","password":"demo123"}'

# Use token in request
curl -X GET http://localhost:3001/api/medications \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Console Debugging

### Good Logs to Look For
```
🔐 Attempting user login...
✅ Login successful
🔐 Fetched all users: [...]
✅ Signup successful
```

### Bad Logs to Troubleshoot
```
❌ Login failed: 401 Unauthorized
  → Check credentials
  → Check user exists in MySQL

❌ Failed to fetch medications: 401
  → Token missing or invalid
  → Check localStorage has token
  → Check token not expired

❌ Network error
  → Check backend is running
  → Check localhost:3001 is accessible
```

## Common Issues & Solutions

### Issue: "Login failed" immediately
**Solution**:
1. Verify backend is running: `npm start` in backend folder
2. Check MySQL is running
3. Check credentials are correct (case-sensitive email)
4. Check Network tab for actual error message

### Issue: Token not stored
**Solution**:
1. Check localStorage is not disabled
2. Check browser DevTools → Application → Local Storage
3. Check CORS is enabled (should be by default)

### Issue: "Can't GET /api/medications"
**Solution**:
1. Check Authorization header sent (Network tab)
2. Check token format: `Authorization: Bearer <token>`
3. Check token not expired (exp claim in JWT)
4. Check user has medications in database

### Issue: Data not saving
**Solution**:
1. Check MySQL is running and database exists
2. Check Network tab for 500 errors
3. Check backend console for SQL errors
4. Verify user ID is correct in request

### Issue: Admin login fails with correct password
**Solution**:
1. Verify user is actually admin: `SELECT role FROM users WHERE email = 'admin@doseguard.app'`
2. Check backend validating role === 'admin'
3. Check console for exact error message

## Performance Testing

### Load Test (Optional)
1. Open DevTools → Network tab
2. Perform actions: login, view medications, mark reminders
3. **Check**:
   - All requests complete < 500ms
   - No 200+ failed requests
   - Token included in headers

### Data Persistence Test
1. Login and add/modify data
2. Refresh the page (Ctrl+R)
3. **Check**:
   - Data still visible (from localStorage + API)
   - User still logged in
   - No re-login needed

## Success Checklist

- [ ] Backend running on localhost:3001
- [ ] Frontend running on localhost:4200
- [ ] Can login with demo@doseguard.app / demo123
- [ ] Dashboard displays user's medications
- [ ] Can mark reminders as taken
- [ ] Token stored in localStorage
- [ ] Can admin login with admin@doseguard.app / admin123
- [ ] Network tab shows API calls with Authorization header
- [ ] MySQL database contains real data
- [ ] No "mock" data visible in UI
- [ ] Error messages display on login failure
- [ ] Console shows success and warning logs

## Next Integration Tasks

After verifying all tests pass:

1. **Dashboard Component** - Subscribe to medication service
2. **Add Medication** - Submit form data via service
3. **Medications List** - Display from API, not mock
4. **Reminders** - Display from API with date filtering
5. **Admin Dashboard** - Display users/stats from admin service
6. **Settings** - Read/update user profile from API
7. **Error Handling** - Catch and display API errors
8. **Loading States** - Show spinners during API calls

## Getting Help

**Check These First**:
1. Backend terminal - any error messages?
2. Frontend console - what's the exact error?
3. Network tab - what was the HTTP status?
4. MySQL - does the data exist as expected?
5. localStorage - is token stored correctly?

**If Stuck**:
1. Stop both frontend and backend
2. Restart backend: `npm start`
3. Restart frontend: `npm start`
4. Clear browser cache (Ctrl+Shift+Delete)
5. Check all three tests pass: Backend → DB → Frontend
