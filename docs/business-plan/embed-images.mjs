#!/usr/bin/env node
/**
 * Embed all local images as base64 data URIs in HTML files.
 * Makes HTML files fully self-contained (no external dependencies).
 *
 * Usage: node embed-images.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';

const DIR = dirname(new URL(import.meta.url).pathname);

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function embedImages(htmlFile) {
  const htmlPath = join(DIR, htmlFile);
  let html = readFileSync(htmlPath, 'utf-8');
  let count = 0;

  // Match src="screenshots/..." in <img> tags
  html = html.replace(/src="(screenshots\/[^"]+)"/g, (match, relPath) => {
    const imgPath = join(DIR, relPath);
    if (!existsSync(imgPath)) {
      console.warn(`  ⚠ Image not found: ${relPath}`);
      return match;
    }
    const ext = extname(relPath).toLowerCase();
    const mime = MIME_TYPES[ext];
    if (!mime) {
      console.warn(`  ⚠ Unknown MIME type for: ${relPath}`);
      return match;
    }
    const base64 = readFileSync(imgPath).toString('base64');
    count++;
    return `src="data:${mime};base64,${base64}"`;
  });

  writeFileSync(htmlPath, html, 'utf-8');
  return count;
}

// Process all HTML files in the directory
const htmlFiles = readdirSync(DIR).filter(f => f.endsWith('.html'));

console.log(`Found ${htmlFiles.length} HTML files\n`);

for (const file of htmlFiles) {
  const count = embedImages(file);
  const sizeKB = Math.round(readFileSync(join(DIR, file)).length / 1024);
  console.log(`✓ ${file}: ${count} images embedded (${sizeKB} KB)`);
}

console.log('\nDone! All HTML files are now self-contained.');
