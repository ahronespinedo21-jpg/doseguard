/**
 * scripts/createAdmin.js
 * Delegates to the consolidated ensureAdmin routine to set up the admin account.
 */
const ensureAdmin = require('../ensure-admin');

console.log('\n🔐 Invoking DoseGuard Admin Account Creation...');
ensureAdmin({ isModule: false });
