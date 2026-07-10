const fs = require('fs');
const path = require('path');

const NEXT_DIR = path.join(__dirname, '..', '.next');
const MANIFEST_PATH = path.join(NEXT_DIR, 'build-manifest.json');

// Budget in bytes
const PAGE_BUDGET_LIMIT = 200 * 1024; // 200 KB
const COMMON_BUDGET_LIMIT = 250 * 1024; // 250 KB (shared assets)

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('❌ Error: build-manifest.json not found! Run "next build" first.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

let exceeded = false;
console.log('📊 Checking bundle sizes against budget limits...');

// 1. Calculate page sizes (first-load JS)
Object.keys(manifest.pages).forEach((page) => {
  const files = manifest.pages[page];
  let totalPageSize = 0;

  files.forEach((file) => {
    const filePath = path.join(NEXT_DIR, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      totalPageSize += stats.size;
    }
  });

  const totalPageSizeKb = (totalPageSize / 1024).toFixed(2);
  const limitKb = (PAGE_BUDGET_LIMIT / 1024).toFixed(2);

  if (totalPageSize > PAGE_BUDGET_LIMIT) {
    console.error(`❌ Page "${page}" exceeds budget: ${totalPageSizeKb} KB (Max limit: ${limitKb} KB)`);
    exceeded = true;
  } else {
    console.log(`✅ Page "${page}": ${totalPageSizeKb} KB`);
  }
});

// 2. Calculate size of shared framework chunks
const commonFiles = manifest.lowPriorityFiles || [];
let totalCommonSize = 0;

commonFiles.forEach((file) => {
  const filePath = path.join(NEXT_DIR, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    totalCommonSize += stats.size;
  }
});

const totalCommonSizeKb = (totalCommonSize / 1024).toFixed(2);
const commonLimitKb = (COMMON_BUDGET_LIMIT / 1024).toFixed(2);

if (totalCommonSize > COMMON_BUDGET_LIMIT) {
  console.error(`❌ Shared chunks exceed budget: ${totalCommonSizeKb} KB (Max limit: ${commonLimitKb} KB)`);
  exceeded = true;
} else {
  console.log(`✅ Shared chunks: ${totalCommonSizeKb} KB`);
}

if (exceeded) {
  console.error('\n❌ Bundle budget enforcement failed. Optimize imports or remove unused dependencies!');
  process.exit(1);
} else {
  console.log('\n✨ All bundle sizes are within the allowed budget constraints!');
  process.exit(0);
}
