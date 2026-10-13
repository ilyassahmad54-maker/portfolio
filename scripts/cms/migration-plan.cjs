const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { loadModule } = require('./load-module.cjs');
const { validatePortfolio } = loadModule('lib/cms/validation.ts');
const { canonicalJSON, contentHash } = loadModule('lib/cms/document.ts');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function publicReferences(data) {
  return [...new Set([data.profile.profileImage, ...data.projects.map(p => p.image), data.profile.cvUrl])]
    .map(ref => {
      if (!ref.startsWith('/assets/') && ref !== '/cv.pdf') throw new Error('Seed requires deployable local public assets');
      return `public${ref}`;
    }).sort();
}

function readContained(root, relative) {
  const resolvedRoot = fs.realpathSync(root);
  const file = fs.realpathSync(path.join(root, relative));
  if (!file.startsWith(resolvedRoot + path.sep) || !fs.statSync(file).isFile()) throw new Error('Backup path escapes its root or is not a file');
  return fs.readFileSync(file);
}

/** Reads published data only. No environment reads, network calls, or database connections. */
function createPlan(root = process.cwd(), parent = os.tmpdir()) {
  const raw = readContained(root, 'data.json');
  const data = JSON.parse(raw);
  validatePortfolio(data);
  const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => /^\d+_[a-z_]+\.sql$/.test(f)).sort().map(f => `supabase/migrations/${f}`);
  const previewMigrations=fs.existsSync(path.join(root,'supabase/preview-migrations'))?fs.readdirSync(path.join(root,'supabase/preview-migrations')).filter(f=>/^\d+_[a-z_]+\.sql$/.test(f)).sort().map(f=>`supabase/preview-migrations/${f}`):[];
  const names = ['data.json', 'lib/cms/portfolio.schema.json',
    ...(fs.existsSync(path.join(root,'lib/cms/legacy-assets.json')) ? ['lib/cms/legacy-assets.json'] : []),
    ...migrations, ...previewMigrations, ...publicReferences(data)];
  // Validate all input references before creating any backup artifacts.
  const files = names.map(name => ({ name, bytes: readContained(root, name) }));
  const directory = fs.mkdtempSync(path.join(parent, 'portfolio-cms-plan-'));
  fs.chmodSync(directory, 0o700);
  for (const { name, bytes } of files) {
    const target = path.join(directory, name);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
  }
  const canonical = canonicalJSON(data);
  fs.writeFileSync(path.join(directory, 'seed-source.canonical.json'), canonical, { flag: 'wx', mode: 0o600 });
  const manifest = {
    formatVersion: 1,
    schemaVersion: 1,
    migrationId: 'published-data-json-v1',
    source: 'data.json',
    sourceSha256: digest(raw),
    canonicalSourceSha256: contentHash(data),
    createdAt: new Date().toISOString(),
    projects: data.projects.map((p, index) => ({ order: index + 1, id: p.id, title: p.title, category: p.category, image: p.image })),
    files: files.map(({ name, bytes }) => ({ path: name, bytes: bytes.length, sha256: digest(bytes) })),
  };
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  validatePlan(directory);
  return { directory, manifest };
}

function validatePlan(directory) {
  const manifest = JSON.parse(readContained(directory, 'manifest.json'));
  if (manifest.formatVersion !== 1 || manifest.schemaVersion !== 1 || manifest.migrationId !== 'published-data-json-v1' || manifest.source !== 'data.json') throw new Error('Unsupported backup manifest');
  if (!Array.isArray(manifest.files)) throw new Error('Invalid backup manifest');
  const paths = new Set();
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || paths.has(file.path) || !/^(data\.json|lib\/cms\/(?:portfolio\.schema|legacy-assets)\.json|supabase\/(?:migrations|preview-migrations)\/\d+_[a-z_]+\.sql|public\/cv\.pdf|public\/assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(png|jpe?g|webp|gif|pdf))$/.test(file.path)) throw new Error('Unexpected backup path');
    paths.add(file.path);
    const bytes = readContained(directory, file.path);
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error('Backup checksum mismatch');
  }
  for (const required of ['data.json', 'lib/cms/portfolio.schema.json',
    'supabase/migrations/202610120001_cms_foundation.sql',
    'supabase/migrations/202610120002_content_schema.sql',
    'supabase/migrations/202610120003_revisions_and_seed.sql']) {
    if (!paths.has(required)) throw new Error('Incomplete foundation backup');
  }
  if (paths.has('supabase/migrations/202610120004_legacy_assets.sql') && !paths.has('lib/cms/legacy-assets.json')) throw new Error('Missing asset baseline manifest');
  const raw = readContained(directory, 'data.json');
  const data = JSON.parse(raw);
  validatePortfolio(data);
  if (digest(raw) !== manifest.sourceSha256 || contentHash(data) !== manifest.canonicalSourceSha256) throw new Error('Seed checksum mismatch');
  if (readContained(directory, 'seed-source.canonical.json').toString('utf8') !== canonicalJSON(data)) throw new Error('Canonical seed differs from backup');
  for (const file of publicReferences(data)) if (!paths.has(file)) throw new Error('Missing referenced asset');
  const expectedProjects = data.projects.map((p, index) => ({ order: index + 1, id: p.id, title: p.title, category: p.category, image: p.image }));
  if (JSON.stringify(manifest.projects) !== JSON.stringify(expectedProjects)) throw new Error('Project report differs from backup');
  return manifest;
}

if (require.main === module) {
  try {
    const [command, directory, ...extra] = process.argv.slice(2);
    if (extra.length || !['dry-run', 'verify-backup'].includes(command) || (command === 'dry-run' && directory) || (command === 'verify-backup' && !directory)) {
      throw new Error('Usage: migration-plan.cjs dry-run | verify-backup /path/to/backup');
    }
    if (command === 'verify-backup') {
      const manifest = validatePlan(directory);
      console.log(`Verified backup: ${manifest.projects.length} projects; canonical SHA-256 ${manifest.canonicalSourceSha256}`);
    } else {
      const plan = createPlan();
      console.log(`DRY RUN ONLY. No database accessed. Backup: ${plan.directory}`);
      console.log(`Projects: ${plan.manifest.projects.length}; canonical SHA-256: ${plan.manifest.canonicalSourceSha256}`);
      console.table(plan.manifest.projects);
    }
  } catch {
    // Do not echo filesystem contents, environment values, or upstream errors.
    console.error('CMS migration plan failed. Check input validation, asset references, and backup checksums.');
    process.exitCode = 1;
  }
}
module.exports = { createPlan, validatePlan };
