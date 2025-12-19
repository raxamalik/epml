#!/usr/bin/env node
/**
 * Generate secure secrets for environment variables
 * Usage: node scripts/generate-secrets.js
 */

import crypto from 'crypto';

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

console.log('\n🔐 Generate Secure Secrets for Vercel\n');
console.log('Copy these values to your Vercel environment variables:\n');
console.log('SESSION_SECRET=' + generateSecret(32));
console.log('JWT_SECRET=' + generateSecret(32));
console.log('\n⚠️  Keep these secrets secure and never commit them to git!\n');

