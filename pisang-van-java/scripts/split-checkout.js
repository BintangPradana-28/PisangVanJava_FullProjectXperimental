const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'src/features/checkout/service.ts');
const content = fs.readFileSync(srcPath, 'utf8');

// I will extract everything into an object so I can map what goes where.
// This is a bit manual, but since I have the text, I can slice by keywords.

const repoStart = content.indexOf('export async function createCheckoutOrder');
const schemasPath = path.join(__dirname, 'src/features/checkout/schemas.ts');
const repoPath = path.join(__dirname, 'src/repositories/checkout.repository.ts');
const servicePath = path.join(__dirname, 'src/services/checkout.service.ts');

// Wait, I will just write a script that creates identical copies of `service.ts`
// into the three destinations, and then I will use multi_replace to prune them!
// No, pruning 800 lines via multi_replace is too slow and error prone.

// Let's do it using basic string splits.
// Schemas: Lines 1 to 256.
const lines = content.split('\n');

const schemasLines = lines.slice(0, 256);
fs.writeFileSync(schemasPath, schemasLines.join('\n'));

console.log('Schemas created.');
