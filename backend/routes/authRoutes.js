const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  // NOTE: Never log passwords. Route hands off directly to controller.
  console.log(`🔐 Login attempt — email: ${req.body?.email || 'unknown'}`);
  return authController.login(req, res);
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  console.log(`📝 Registration attempt — email: ${req.body?.email || 'unknown'}`);
  return authController.register(req, res);
});

// GET /api/auth/verify-token
router.get('/verify-token', authMiddleware, authController.verifyToken);

// GET /api/auth/test — dev diagnostic only
if (process.env.NODE_ENV !== 'production') {
  router.get('/test', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Auth routes are working',
      availableRoutes: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        verifyToken: 'GET /api/auth/verify-token'
      }
    });
  });
}

module.exports = router;
