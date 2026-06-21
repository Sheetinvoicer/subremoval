const fs = require('node:fs');
const path = require('node:path');

const targetPath = path.join(process.cwd(), 'issue.md.junie_standalone');

if (!fs.existsSync(targetPath)) {
  fs.writeFileSync(
    targetPath,
    '# Auto-generated fallback\n\nThis file is generated during build when missing.\n',
    'utf8'
  );
  console.log('Generated missing issue.md.junie_standalone fallback file.');
} else {
  console.log('issue.md.junie_standalone already exists.');
}