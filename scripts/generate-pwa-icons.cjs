const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const publicDir = path.join(__dirname, '..', 'public');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#grad)"/>
  <text x="256" y="280" font-family="Arial, sans-serif" font-size="200" font-weight="bold" fill="white" text-anchor="middle">F</text>
</svg>`;

async function generateIcons() {
  const sizes = [
    { name: 'pwa-192x192.png', size: 192 },
    { name: 'pwa-512x512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];

  for (const { name, size } of sizes) {
    await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, name));
    console.log(`Generated ${name}`);
  }

  // Also generate maskable icon
  await sharp(Buffer.from(svgContent))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'maskable-icon.png'));
  console.log('Generated maskable-icon.png');

  console.log('All PWA icons generated successfully!');
}

generateIcons().catch(console.error);
