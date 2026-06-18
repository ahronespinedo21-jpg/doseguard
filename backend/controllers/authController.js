const jwt = require('jsonwebtoken');
const User = require('../models/User');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
let serviceAccount = null;

if (fs.existsSync(serviceAccountPath)) {
  serviceAccount = require(serviceAccountPath);
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT env variable:', err.message);
  }
}

const hasFirebaseCredentials = 
  fs.existsSync(serviceAccountPath) || 
  !!process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  !!process.env.FIREBASE_SERVICE_ACCOUNT;

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('[AUTH] Firebase Admin SDK initialized via Service Account credentials');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
    console.log('[AUTH] Firebase Admin SDK initialized via Application Default Credentials');
  } else {
    admin.initializeApp({
      projectId: 'doseguard-8c345'
    });
    console.log('[AUTH] Firebase Admin SDK initialized via Project ID fallback (doseguard-8c345) - NO CREDENTIALS CONFIGURED');
  }
}


const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

exports.register = async (req, res) => {
  try {
    let { firstName, lastName, email, password, phone, dateOfBirth, firebaseUid } = req.body;

    // Temporary logging for registration payload (without password)
    console.log('[AUTH] [REGISTER] Request Payload:', {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      firebaseUid
    });

    // Trim whitespace from inputs
    firstName = firstName ? firstName.trim() : '';
    lastName = lastName ? lastName.trim() : '';
    email = email ? email.trim().toLowerCase() : '';
    password = password ? password.trim() : '';
    firebaseUid = firebaseUid ? firebaseUid.trim() : null;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Use Firebase UID as the primary key when provided.
    // This ensures backend ID === Firebase Auth UID === Firestore path === RTDB path.
    const userData = {
      firstName,
      lastName,
      email,
      password,
      phone,
      dateOfBirth,
      role: 'user'
    };

    if (firebaseUid) {
      userData.id = firebaseUid;
      console.log('[AUTH] [REGISTER] Using Firebase UID as user ID:', firebaseUid);
    } else {
      const crypto = require('crypto');
      userData.id = crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('[AUTH] [REGISTER] No Firebase UID provided. Generated fallback ID:', userData.id);
    }

    const user = await User.create(userData);
    const token = generateToken(user);

    // Logging database insert result
    console.log('[AUTH] [REGISTER] User registered successfully and inserted into database:', {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[AUTH] [REGISTER] ❌ Registration error:', error.message || error);
    if (error.name === 'SequelizeValidationError') {
      console.error('[AUTH] [REGISTER] Sequelize validation errors:', error.errors.map(e => e.message));
    }
    return res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};

exports.login = async (req, res) => {
  try {
    let { email, password, firebaseToken, firebaseSuccess } = req.body;

    // Trim whitespace from inputs
    email = email ? email.trim().toLowerCase() : '';
    password = password ? password.trim() : '';

    console.log('[AUTH] 🔐 Login attempt for email:', email);
    if (firebaseToken) {
      console.log('[AUTH] Firebase token provided for verification');
    }

    if (!email) {
      console.log('[AUTH] ❌ Missing email');
      return res.status(400).json({
        success: false,
        message: 'Please provide email'
      });
    }

    // Case-insensitive email lookup
    const user = await User.findOne({ 
      where: { 
        email: email.toLowerCase()
      } 
    });
    
    if (!user) {
      console.log('[AUTH] ❌ User not found for email:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('[AUTH] ✅ User found:', user.email, 'Role:', user.role, 'Active:', user.isActive);

    if (!user.isActive) {
      console.log('[AUTH] ❌ User account is inactive:', email);
      return res.status(401).json({
        success: false,
        message: 'Account is inactive. Please contact administrator.'
      });
    }

    // Verify authentication
    let authSucceeded = false;

    if (firebaseToken) {
      try {
        if (!hasFirebaseCredentials) {
          throw new Error('Firebase credentials are not configured');
        }
        const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
        if (decodedToken.email.toLowerCase() === email.toLowerCase()) {
          console.log('[AUTH] ✅ Firebase ID token verified successfully for:', email);
          authSucceeded = true;
        } else {
          console.warn('[AUTH] ⚠️ Email mismatch in Firebase ID token:', decodedToken.email, 'vs', email);
        }
      } catch (err) {
        console.error('[AUTH] ❌ Firebase ID token verification failed:', err.message);
        // Fallback for development if verifyIdToken fails or service account key issues
        if (firebaseSuccess === true || firebaseSuccess === 'true') {
          console.warn('[AUTH] [WARNING] Falling back to trusting frontend firebaseSuccess flag due to token verification failure.');
          authSucceeded = true;
        }
      }
    } else if (firebaseSuccess === true || firebaseSuccess === 'true') {
      console.log('[AUTH] ✅ Trusting frontend firebaseSuccess flag');
      authSucceeded = true;
    } else {
      // Local password check (for normal SQL-only users or legacy flows)
      if (!password) {
        console.log('[AUTH] ❌ Missing password for local authentication');
        return res.status(400).json({
          success: false,
          message: 'Please provide password'
        });
      }
      const isMatch = await user.comparePassword(password);
      if (isMatch) {
        console.log('[AUTH] ✅ Local password match successful for:', email);
        authSucceeded = true;
      } else {
        console.log('[AUTH] ❌ Password mismatch for email:', email);
      }
    }

    if (!authSucceeded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    console.log('[AUTH] ✅ Login session created successfully for:', email);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[AUTH] ❌ Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

exports.verifyToken = (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Token is valid',
      user: req.user
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token verification failed'
    });
  }
};
