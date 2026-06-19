import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../apps/web/public/icons');

await mkdir(iconsDir, { recursive: true });

const icon192 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="24" fill="#2a9d8f"/>
  <text x="96" y="126" text-anchor="middle"
    font-family="sans-serif" font-weight="600" font-size="80" fill="#f9f6f2">LS</text>
</svg>`;

const icon512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#2a9d8f"/>
  <text x="256" y="336" text-anchor="middle"
    font-family="sans-serif" font-weight="600" font-size="210" fill="#f9f6f2">LS</text>
</svg>`;

const icon512Maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2a9d8f"/>
  <text x="256" y="310" text-anchor="middle"
    font-family="sans-serif" font-weight="600" font-size="160" fill="#f9f6f2">LS</text>
</svg>`;

await sharp(Buffer.from(icon192)).resize(192, 192).png().toFile(join(iconsDir, 'icon-192.png'));
await sharp(Buffer.from(icon512)).resize(512, 512).png().toFile(join(iconsDir, 'icon-512.png'));
await sharp(Buffer.from(icon512Maskable)).resize(512, 512).png().toFile(join(iconsDir, 'icon-512-maskable.png'));

console.log('✓ Icons written to apps/web/public/icons/');
