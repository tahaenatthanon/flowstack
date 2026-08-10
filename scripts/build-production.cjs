/**
 * Production Build Script
 * สร้าง build สำหรับ production และตรวจสอบ PWA
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

console.log('🚀 Production Build Script\n');
console.log('='.repeat(50));

// Step 1: Clean dist folder
console.log('\n🧹 Cleaning dist folder...');
try {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
    console.log('   ✅ Cleaned');
  }
} catch (err) {
  console.log('   ⚠️ dist folder:', err.message);
}

// Step  Cannot clean 2: Build
console.log('\n📦 Building for production...');
try {
  execSync('pnpm build', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
  console.log('   ✅ Build completed');
} catch (err) {
  console.error('   ❌ Build failed');
  process.exit(1);
}

// Step 3: Verify PWA
console.log('\n🔍 Verifying PWA...');
try {
  execSync('node scripts/verify-pwa.cjs', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
} catch (err) {
  console.error('   ❌ PWA verification failed');
  process.exit(1);
}

// Step 4: Summary
console.log('\n' + '='.repeat(50));
console.log('✅ Production build completed successfully!');
console.log('\n📁 Output directory: dist/');
console.log('\n📌 Deploy instructions:');
console.log('   1. Copy all files from dist/ to your web server');
console.log('   2. For XAMPP: copy to htdocs/flowstack/');
console.log('   3. Ensure .htaccess is included');
console.log('   4. Access: http://platform.ktnbs.com:8080/flowstack/');
