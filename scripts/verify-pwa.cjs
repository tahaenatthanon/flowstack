/**
 * PWA Verification Script
 * ตรวจสอบว่า PWA files ถูกสร้างครบถ้วนและถูกต้อง
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'registerSW.js',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'apple-touch-icon.png',
  'favicon.ico',
];

const requiredPatterns = [
  { file: 'index.html', pattern: /manifest\.webmanifest/ },
  { file: 'index.html', pattern: /theme-color/ },
  { file: 'manifest.webmanifest', pattern: /"name":/ },
  { file: 'manifest.webmanifest', pattern: /"start_url":/ },
  { file: 'manifest.webmanifest', pattern: /"scope":/ },
  { file: 'sw.js', pattern: /service.*worker/i },
];

console.log('🔍 PWA Verification Script\n');
console.log('='.repeat(50));

let hasErrors = false;

// Check required files exist
console.log('\n📁 Checking required files...\n');
for (const file of requiredFiles) {
  const filePath = path.join(distDir, file);
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${file}`);
  if (!exists) hasErrors = true;
}

// Check file contents
console.log('\n📝 Checking file contents...\n');
for (const { file, pattern } of requiredPatterns) {
  const filePath = path.join(distDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`  ❌ ${file} (not found)`);
    hasErrors = true;
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = pattern.test(content);
  const status = matches ? '✅' : '❌';
  console.log(`  ${status} ${file}: ${pattern}`);
}

// Check manifest.json content
console.log('\n📋 Manifest details:\n');
const manifestPath = path.join(distDir, 'manifest.webmanifest');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`  Name: ${manifest.name}`);
  console.log(`  Short Name: ${manifest.short_name}`);
  console.log(`  Start URL: ${manifest.start_url}`);
  console.log(`  Scope: ${manifest.scope}`);
  console.log(`  Display: ${manifest.display}`);
  console.log(`  Theme Color: ${manifest.theme_color}`);
  console.log(`  Background Color: ${manifest.background_color}`);
  console.log(`  Icons: ${manifest.icons?.length || 0}`);
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ PWA Verification FAILED');
  process.exit(1);
} else {
  console.log('✅ PWA Verification PASSED');
  console.log('\n📌 Next steps:');
  console.log('   1. Deploy dist/ folder to your web server');
  console.log('   2. Ensure HTTPS is enabled (required for Service Worker)');
  console.log('   3. Open browser DevTools > Application > Service Workers');
  console.log('   4. Test PWA installation');
}
