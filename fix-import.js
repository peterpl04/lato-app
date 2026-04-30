// Truncates import-fixadores.js to remove duplicate trailing content
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'import-fixadores.js');
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Keep only up to and including the final run().catch block (first occurrence)
let cutLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('run().catch(err => {')) {
    cutLine = i;
  }
}

if (cutLine === -1) {
  console.error('Could not find run().catch line');
  process.exit(1);
}

// Include 3 more lines after run().catch: console.error, process.exit, });
const kept = lines.slice(0, cutLine + 4);
fs.writeFileSync(filePath, kept.join('\n'), 'utf8');
console.log(`Done. Kept ${kept.length} lines (was ${lines.length}).`);
