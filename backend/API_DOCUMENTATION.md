# API Response Format

All API responses follow a consistent format:

## Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

## Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

---

# Authentication Endpoints

## Register User
**POST** `/api/auth/register`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "+1234567890",
  "dateOfBirth": "1990-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

---

## Login User
**POST** `/api/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

---

## Verify Token
**GET** `/api/auth/verify-token`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Token is valid",
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "role": "user"
  }
}
```

---

# User Endpoints

All user endpoints require authentication header.

## Get Profile
**GET** `/api/user/profile`

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "dateOfBirth": "1990-01-15",
    "address": "123 Main St",
    "role": "user",
    "isActive": true,
    "lastLogin": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-10T08:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## Update Profile
**PUT** `/api/user/profile`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "dateOfBirth": "1990-01-15",
  "address": "123 Main St"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": { /* updated user object */ }
}
```

---

## Change Password
**POST** `/api/user/change-password`

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

---

## Delete Account
**DELETE** `/api/user/account`

**Request Body:**
```json
{
  "password": "password123"
}
```

---

# Medication Endpoints

All medication endpoints require authentication.

## Create Medication
**POST** `/api/medications`

**Request Body:**
```json
{
  "name": "Aspirin",
  "dosage": "500mg",
  "dosageType": "specific",
  "frequency": "twice daily",
  "timeSchedule": ["08:00", "20:00"],
  "amount": 100,
  "category": "Pain Relief",
  "startDate": "2024-01-15",
  "endDate": "2024-06-15",
  "stockLevel": 50,
  "notes": "Take with food",
  "isPillboxConnected": false
}
```

---

## Get Medications
**GET** `/api/medications`

**Response:**
```json
{
  "success": true,
  "count": 5,
  "medications": [
    {
      "id": "uuid",
      "userId": "uuid",
      "name": "Aspirin",
      "dosage": "500mg",
      "frequency": "twice daily",
      "timeSchedule": ["08:00", "20:00"],
      "stockLevel": 50,
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

## Get Low Stock Medications
**GET** `/api/medications/low-stock`

Returns medications with stockLevel ≤ 10

---

## Get Medication by ID
**GET** `/api/medications/:id`

---

## Update Medication
**PUT** `/api/medications/:id`

**Request Body:** Same as create (any fields to update)

---

## Delete Medication
**DELETE** `/api/medications/:id`

---

# Reminder Endpoints

All reminder endpoints require authentication.

## Log Reminder
**POST** `/api/reminders/log`

**Request Body:**
```json
{
  "medicationId": "uuid",
  "status": "taken",
  "scheduledTime": "08:00",
  "takenTime": "08:05",
  "notes": "Took with breakfast"
}
```

**Status Options:**
- `taken` - Medication was taken
- `missed` - Medication was missed
- `snoozed` - Reminder was snoozed
- `skipped` - Medication was skipped

---

## Get Reminder Logs
**GET** `/api/reminders/logs`

**Query Parameters:**
- `startDate` - Filter from date (ISO format)
- `endDate` - Filter to date (ISO format)
- `medicationId` - Filter by medication

**Example:** `/api/reminders/logs?startDate=2024-01-01&endDate=2024-01-31`

---

## Get Adherence Statistics
**GET** `/api/reminders/adherence`

**Query Parameters:**
- `startDate` - Default: 7 days ago
- `endDate` - Default: today

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 14,
    "taken": 12,
    "missed": 1,
    "snoozed": 1,
    "skipped": 0,
    "adherenceRate": "85.71",
    "startDate": "2024-01-08T00:00:00Z",
    "endDate": "2024-01-15T23:59:59Z"
  }
}
```

---

## Get Today's Reminders
**GET** `/api/reminders/today`

Returns all reminders scheduled for today sorted by time

---

# Admin Endpoints

All admin endpoints require:
1. Authentication header
2. User role must be `admin`

## Get All Users
**GET** `/api/admin/users`

**Response:**
```json
{
  "success": true,
  "count": 5,
  "users": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "role": "user",
      "isActive": true,
      "createdAt": "2024-01-10T08:00:00Z"
    }
  ]
}
```

---

## Get User Details
**GET** `/api/admin/users/:userId`

**Response:**
```json
{
  "success": true,
  "user": { /* user object */ },
  "stats": {
    "medications": 5,
    "reminders": 42,
    "taken": 38
  }
}
```

---

## Delete User
**DELETE** `/api/admin/users/:userId`

Deletes user and all associated medications and reminder logs

---

## Get All Medications
**GET** `/api/admin/medications`

Returns all medications from all users

---

## Get All Reminder Logs
**GET** `/api/admin/reminder-logs`

**Query Parameters:**
- `status` - Filter by status (taken, missed, snoozed, skipped)

---

## Get System Statistics
**GET** `/api/admin/stats/system`

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalUsers": 25,
    "totalMedications": 150,
    "totalReminders": 3500,
    "takenReminders": 3200,
    "missedReminders": 300,
    "adherenceRate": "91.43"
  }
}
```

---

# Error Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing/invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `500 Internal Server Error` - Server error
