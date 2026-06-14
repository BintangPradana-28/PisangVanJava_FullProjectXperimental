const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /'@\/components\/user\/CartModal'/g, to: "'@/src/features/cart/components/CartModal'" },
  { from: /"@\/components\/user\/CartModal"/g, to: '"@/src/features/cart/components/CartModal"' },
  
  { from: /'@\/components\/user\/CartDrawer'/g, to: "'@/src/features/cart/components/CartDrawer'" },
  { from: /"@\/components\/user\/CartDrawer"/g, to: '"@/src/features/cart/components/CartDrawer"' },
  
  { from: /'@\/components\/user\/MergeConflictModal'/g, to: "'@/src/features/cart/components/MergeConflictModal'" },
  { from: /"@\/components\/user\/MergeConflictModal"/g, to: '"@/src/features/cart/components/MergeConflictModal"' },
  
  { from: /'@\/src\/stores\/cart\.store'/g, to: "'@/src/features/cart/stores/cart.store'" },
  { from: /"@\/src\/stores\/cart\.store"/g, to: '"@/src/features/cart/stores/cart.store"' },
  
  { from: /'@\/src\/providers\/CartSyncProvider'/g, to: "'@/src/features/cart/providers/CartSyncProvider'" },
  { from: /"@\/src\/providers\/CartSyncProvider"/g, to: '"@/src/features/cart/providers/CartSyncProvider"' },
  
  // Specific relative import fix
  { from: /from '\.\/CartModal'/g, to: "from '@/src/features/cart/components/CartModal'" },
  { from: /from "\.\/CartModal"/g, to: 'from "@/src/features/cart/components/CartModal"' }
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      if (!file.includes('node_modules') && !file.includes('.next')) {
        results = results.concat(walk(file));
      }
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = [
  ...walk('app'),
  ...walk('src'),
  ...walk('components')
];

let updatedFiles = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;
  
  replacements.forEach(r => {
    newContent = newContent.replace(r.from, r.to);
  });
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Updated:', file);
    updatedFiles++;
  }
});

console.log('Total files updated:', updatedFiles);
