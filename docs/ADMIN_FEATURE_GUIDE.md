# DoseGuard Admin Account Feature Documentation

## Overview
The DoseGuard Admin Account feature provides administrative access to manage users and medications in the system. This document outlines the implementation, features, and security measures.

## Features Implemented

### 1. **Admin Login System**
- **Location**: `/admin-login` route
- **Entry Point**: "Administrator Access" button on the user login page (purple button below login form)
- **Credentials** (Demo - Hardcoded):
  - Username: `admin`
  - Password: `Admin@123`
- **Security**: 
  - Password visibility toggle
  - Form validation for email/username format
  - Error handling for invalid credentials
  - Credentials must match predefined admin data
  - Admin authentication status stored in localStorage

### 2. **Admin Dashboard**
- **Location**: `/admin` route (protected by AdminGuard)
- **Features**:
  - Overview statistics:
    - Total Users
    - Total Medications
    - Active Medications
    - Users with Reminders
  - Recent Users display (last 5)
  - Recent Medications display (last 5)
  - Quick action buttons to navigate to management pages
  - Responsive sidebar navigation
  - Logout functionality

### 3. **User Management**
- **Location**: `/admin/users` route
- **Features**:
  - **View**: Display all registered users in a table
  - **Search**: Search users by name or email
  - **Add**: Create new users with form validation
    - Required fields: Name (min 2 chars), Email, Phone
  - **Edit**: Update user information
  - **Delete**: Remove users with confirmation dialog
  - Real-time table updates
  - Responsive design

### 4. **Medication Records**
- **Location**: `/admin/medications` route
- **Features**:
  - View all medication reminders with details
  - Information displayed:
    - Medication name
    - Associated user
    - Dosage
    - Frequency
    - Scheduled time
    - Status (Active/Inactive)
    - Creation date
  - **Search**: Find medications by name or user
  - **Filter**: Filter by status (All, Active, Inactive)
  - Summary statistics showing:
    - Total medications
    - Active medications
    - Filtered results count

### 5. **Security Features**
- **Admin Guard**: Prevents normal users from accessing admin routes
  - Routes `/admin/*` are protected
  - Unauthenticated users redirected to `/admin-login`
- **Session Management**: Admin session stored in localStorage
- **Role-Based Access**: Clear separation between regular user and admin roles
- **Auth Service**: Extended admin functionality in AdminService

### 6. **UI/UX Features**
- **Purple Gradient Theme**: Matches DoseGuard branding
- **"Admin Panel" Label**: Clearly indicates admin interface
- **Responsive Design**: Mobile-friendly layout
- **Sidebar Navigation**: Easy navigation between admin sections
- **Interactive Elements**:
  - Hover effects on buttons and rows
  - Loading states for async operations
  - Form validation with error messages
  - Confirmation dialogs for destructive actions

## Admin Routes

All admin routes are protected by `AdminGuard`:

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin-login` | AdminLoginComponent | Admin login page |
| `/admin` | AdminDashboardComponent | Main admin dashboard |
| `/admin/users` | UserManagementComponent | User management (CRUD) |
| `/admin/medications` | MedicationRecordsComponent | View medication records |
| `/admin/devices` | DeviceManagementComponent | Device management |
| `/admin/analytics` | AdherenceAnalyticsComponent | Analytics/reports |
| `/admin/chatbot` | ChatbotLogsComponent | Chatbot logs |
| `/admin/alerts` | AlertsReportsComponent | Alerts and reports |
| `/admin/settings` | SystemSettingsComponent | System settings |

## File Structure

```
src/app/
├── services/
│   └── admin.service.ts          # Admin business logic
├── guards/
│   └── admin.guard.ts            # Route protection
├── pages/
│   ├── login/
│   │   ├── login.component.ts    # Updated with admin button
│   │   └── login.component.html
│   ├── admin-login/
│   │   ├── admin-login.component.ts
│   │   ├── admin-login.component.html
│   │   └── admin-login.component.css
│   └── admin/
│       ├── dashboard/
│       ├── users/
│       ├── medications/
│       ├── devices/
│       ├── analytics/
│       ├── chatbot/
│       ├── alerts/
│       └── settings/
└── app.routes.ts                 # Updated routes with guard
```

## AdminService Methods

### Authentication
- `adminLogin(username: string, password: string)`: Authenticate admin
- `adminLogout()`: Log out admin and clear session
- `isAdminAuthenticated: boolean`: Check if admin is logged in
- `getCurrentAdmin()`: Get current admin info

### User Management
- `getAllUsers()`: Get all registered users
- `getUserById(id: string)`: Get specific user
- `addUser(user)`: Create new user
- `updateUser(id: string, updates)`: Update user info
- `deleteUser(id: string)`: Delete user

### Medication Management
- `getAllMedicationRecords()`: Get all medication records
- `getUserMedicationRecords(userId: string)`: Get user's medications
- `getDashboardStats()`: Get dashboard statistics

## Mock Data

### Admin Credentials
```typescript
{
  username: 'admin',
  password: 'Admin@123'
}
```

### Sample Users
The system includes 4 mock users:
- John Doe (john@example.com)
- Jane Smith (jane@example.com)
- Mike Johnson (mike@example.com)
- Sarah Williams (sarah@example.com)

### Sample Medications
The system includes 5 sample medication records across users.

## How to Use

### For Administrators

1. **Access Admin Panel**:
   - Go to user login page
   - Click "Administrator Access" button
   - Enter admin credentials

2. **Manage Users**:
   - Navigate to "User Management"
   - Click "Add New User" to create
   - Click "Edit" to modify existing user
   - Click "Delete" to remove user

3. **View Medications**:
   - Navigate to "Medications"
   - Use search to find specific medications
   - Filter by status to see active/inactive
   - View all medication details

4. **Logout**:
   - Click "Logout" button in header
   - Session will be cleared

### For Developers

#### Adding a New Admin-Only Page

1. Create component in `/src/app/pages/admin/[page-name]/`
2. Implement component with `AdminService` injection
3. Add route to `app.routes.ts` with `AdminGuard`
4. Update sidebar in admin dashboard template

Example:
```typescript
{
  path: 'admin/new-page',
  component: NewPageComponent,
  canActivate: [AdminGuard]
}
```

#### Extending AdminService

Add new methods to handle additional admin functionality:

```typescript
// In admin.service.ts
myNewMethod(): any {
  // Implementation
}
```

## Security Considerations

### Current Implementation
- ✅ Hardcoded demo credentials (for testing)
- ✅ Admin guard on protected routes
- ✅ Session-based authentication
- ✅ Role separation (admin vs user)

### Production Recommendations
- Replace hardcoded credentials with backend API authentication
- Implement JWT tokens instead of localStorage strings
- Add password reset/recovery mechanism
- Implement audit logging for admin actions
- Add multi-factor authentication
- Use HTTPS for all connections
- Implement rate limiting on login attempts
- Add IP whitelisting for admin access

## Theme Colors

The admin panel uses the DoseGuard purple gradient theme:
- Primary: Purple (`#A855F7` to `#7C3AED`)
- Accent: Various supporting colors for UI elements
- Background: Light gray for main content area
- Sidebar: Dark gray/charcoal

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers supported

## Future Enhancements

- [ ] Role-based access control (RBAC)
- [ ] Advanced analytics and reporting
- [ ] Export data to CSV/PDF
- [ ] Batch user import/export
- [ ] Real-time medication tracking
- [ ] Activity logs and audit trail
- [ ] Email notifications
- [ ] SMS alerts for admins
- [ ] Advanced filtering options
- [ ] Dashboard customization

## Troubleshooting

### Admin can't login
- Check credentials: `admin` / `Admin@123`
- Ensure JavaScript is enabled
- Clear browser cache and localStorage

### Can't access admin pages
- Verify you're logged in as admin
- Check browser console for errors
- Ensure AuthGuard is properly imported in routes

### Users/Medications not showing
- Refresh the page
- Check browser console for errors
- Verify AdminService is properly injected

## Support

For issues or questions about the admin feature:
1. Check this documentation
2. Review the component files
3. Check browser console for error messages
4. Contact development team

---

**Last Updated**: April 8, 2026
**Version**: 1.0
