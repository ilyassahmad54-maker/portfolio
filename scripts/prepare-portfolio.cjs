// Prepare an Edit Mode export locally. Never commits or deploys.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/prepare-portfolio.cjs /path/to/export.json');
const data = JSON.parse(fs.readFileSync(source, 'utf8'));
const previous = JSON.parse(fs.readFileSync('data.json', 'utf8'));
if (!data.profile || !Array.isArray(data.projects)) throw new Error('Invalid portfolio export');
for (const project of previous.projects) {
  if (!data.projects.some(p => p.id === project.id)) throw new Error(`Export omits existing project: ${project.title}`);
}
const assets = [];
function image(value) {
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
  if (match) {
    const bytes = Buffer.from(match[2], 'base64');
    const name = `imported-${crypto.createHash('sha256').update(bytes).digest('hex').slice(0,20)}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`;
    assets.push([path.join('public/assets', name), bytes]);
    return `/assets/${name}`;
  }
  if (typeof value !== 'string' || !value.startsWith('/assets/') || value.includes('..') || !fs.existsSync(path.join('public', value))) {
    throw new Error('Images must be embedded PNG/JPEG/WebP/GIF or existing /assets/ files; temporary and remote URLs are rejected');
  }
  return value;
}
data.profile.profileImage = image(data.profile.profileImage);
for (const project of data.projects) project.image = image(project.image);
delete data.adminPasscode;
const backup = fs.mkdtempSync('/tmp/portfolio-content-backup-');
fs.copyFileSync('data.json', path.join(backup, 'data.json'));
fs.copyFileSync('data/portfolio.ts', path.join(backup, 'portfolio.ts'));
fs.copyFileSync(source, path.join(backup, 'source-export.json'));
for (const [file, bytes] of assets) fs.writeFileSync(file, bytes);
fs.writeFileSync('data.json', JSON.stringify(data, null, 2) + '\n');
console.log(`Prepared ${data.projects.length} projects, ${assets.length} embedded assets. Backup: ${backup}`);
