#!/usr/bin/env node

/**
 * Generate Apple Sign In Client Secret JWT
 * 
 * This script generates a JWT token that Supabase needs for Apple OAuth.
 * The token is valid for 180 days (Apple's maximum).
 * 
 * Run: node generate-apple-secret.cjs
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Read configuration from .env.local
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_SERVICES_ID = process.env.APPLE_SERVICES_ID;

// Validate required environment variables
if (!APPLE_KEY_ID || !APPLE_TEAM_ID || !APPLE_SERVICES_ID) {
  console.error('❌ Error: Missing required environment variables in .env.local');
  console.error('   Required: APPLE_KEY_ID, APPLE_TEAM_ID, APPLE_SERVICES_ID');
  process.exit(1);
}

// Look for the .p8 key file
const keyFileName = `AuthKey_${APPLE_KEY_ID}.p8`;
const keyPath = path.join(__dirname, keyFileName);

if (!fs.existsSync(keyPath)) {
  console.error(`❌ Error: Private key file not found: ${keyFileName}`);
  console.error('   Expected location:', keyPath);
  console.error('   Download it from Apple Developer Portal → Keys');
  process.exit(1);
}

// Read the private key
const privateKey = fs.readFileSync(keyPath, 'utf8');

// Generate the JWT
const now = Math.floor(Date.now() / 1000);
const expiresIn = 180 * 24 * 60 * 60; // 180 days in seconds (Apple's max)

const token = jwt.sign(
  {
    iss: APPLE_TEAM_ID,
    iat: now,
    exp: now + expiresIn,
    aud: 'https://appleid.apple.com',
    sub: APPLE_SERVICES_ID,
  },
  privateKey,
  {
    algorithm: 'ES256',
    keyid: APPLE_KEY_ID,
  }
);

// Calculate expiration date
const expirationDate = new Date((now + expiresIn) * 1000);

console.log('✅ Apple Client Secret JWT generated successfully!\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Copy this JWT and paste it into Supabase:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(token);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📋 Configuration Summary:');
console.log(`   Client ID (Services ID): ${APPLE_SERVICES_ID}`);
console.log(`   Team ID: ${APPLE_TEAM_ID}`);
console.log(`   Key ID: ${APPLE_KEY_ID}`);
console.log(`   Token expires: ${expirationDate.toLocaleDateString()} (${expirationDate.toLocaleString()})`);
console.log('\n⚠️  IMPORTANT: This token expires in 180 days!');
console.log('   Set a reminder to regenerate it before:', expirationDate.toLocaleDateString());
console.log('\n📝 Next Steps:');
console.log('   1. Go to Supabase Dashboard → Authentication → Providers');
console.log('   2. Enable "Apple" provider');
console.log('   3. Paste the JWT above into the "Secret Key" field');
console.log(`   4. Set Client ID to: ${APPLE_SERVICES_ID}`);
console.log('   5. Save\n');
