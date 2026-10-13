const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadModule } = require('../scripts/cms/load-module.cjs');
const { validatePortfolio, ContentValidationError, validContentFormat } = loadModule('lib/cms/validation.ts');
const { canonicalJSON, contentHash } = loadModule('lib/cms/document.ts');
const { createPlan, validatePlan } = require('../scripts/cms/migration-plan.cjs');
const published = require('../data.json');

test('foundation validates the exact eight-project source without mutation', () => {
  const data = structuredClone(published);
  validatePortfolio(data);
  assert.deepEqual(data, published);
  assert.equal(data.projects.length, 8);
  assert.equal(data.projects[0].id, 'proj-1791656404798');
  assert.equal(data.projects[1].image, '/assets/riskradar-6b4d1ab9f5bdadbcf9ae.jpg');
});

test('all sections reject wrong types, missing required fields, and unknown fields', () => {
  for (const section of Object.keys(published)) {
    const data = structuredClone(published);
    data[section] = null;
    assert.throws(() => validatePortfolio(data), ContentValidationError);
    delete data[section];
    assert.throws(() => validatePortfolio(data), ContentValidationError);
  }
  const data = structuredClone(published);
  data.adminPasscode = 'not-a-real-secret';
  assert.throws(() => validatePortfolio(data), error => error instanceof ContentValidationError && !error.message.includes('not-a-real-secret'));
  delete data.adminPasscode;
  data.projects[0].tags = [123];
  assert.throws(() => validatePortfolio(data), ContentValidationError);
});

test('duplicate IDs/platforms and invalid categories are rejected', () => {
  for (const section of ['skills','experience','projects','education','certifications','socialLinks']) {
    const data = structuredClone(published);
    data[section].push(data[section][0]);
    assert.throws(() => validatePortfolio(data), ContentValidationError);
  }
  const data = structuredClone(published);
  data.projects[0].category = 'Other';
  assert.throws(() => validatePortfolio(data), ContentValidationError);
  data.projects[0].category = published.projects[0].category;
  data.projects[0].id += '\n';
  assert.throws(() => validatePortfolio(data), ContentValidationError);
});

test('unsafe URLs and temporary images are rejected; legacy placeholders survive', () => {
  for (const url of ['javascript:alert(1)','data:text/html;base64,eA==','http://example.com','https://user:pass@example.com','https://localhost','https://127.0.0.1','https://example.internal','https://example.com\\evil','https://example.com\n']) {
    const data = structuredClone(published);
    data.projects[0].demoUrl = url;
    assert.throws(() => validatePortfolio(data), ContentValidationError);
  }
  for (const image of ['blob:https://example.com/temporary','file:///tmp/image.png','data:image/png;base64,eA==','https://example.com/image.png','/assets/../secret.png','/assets/%2e%2e/secret.png','/assets/image.svg']) {
    const data = structuredClone(published);
    data.projects[0].image = image;
    assert.throws(() => validatePortfolio(data), ContentValidationError);
  }
  assert.ok(validContentFormat('web-link', '#'));
  assert.ok(validContentFormat('web-link', ''));
  assert.ok(validContentFormat('image-ref', '/api/assets/01234567-89ab-cdef-0123-456789abcdef'));
});

test('schema enforces content/collection/text limits and restricted destinations', () => {
  const data = structuredClone(published);
  data.projects[0].description = 'x'.repeat(20001);
  assert.throws(() => validatePortfolio(data), ContentValidationError);
  data.projects[0].description = 'x'.repeat(1024 * 1024);
  assert.throws(() => validatePortfolio(data), ContentValidationError);
  data.projects = Array.from({length:201}, () => published.projects[0]);
  assert.throws(() => validatePortfolio(data), ContentValidationError);
  for (const [field, value] of [['formspreeEndpoint','https://evil.example/f/test'],['cvUrl','https://evil.example/cv.pdf']]) {
    const candidate = structuredClone(published);
    candidate.profile[field] = value;
    assert.throws(() => validatePortfolio(candidate), ContentValidationError);
  }
});

test('canonical hashes ignore object-key order but retain project order and all values', () => {
  const reordered = Object.fromEntries(Object.entries(published).reverse());
  assert.equal(contentHash(reordered), contentHash(published));
  const changed = structuredClone(published);
  changed.projects.reverse();
  assert.notEqual(contentHash(changed), contentHash(published));
  assert.deepEqual(JSON.parse(canonicalJSON(published)), published);
  execFileSync(process.execPath, ['scripts/cms/generate-schema.cjs','--check']);
});

test('dry-run makes a verified backup including images/CV, without rewriting source', () => {
  const before = fs.readFileSync('data.json');
  const { directory, manifest } = createPlan();
  assert.equal(manifest.projects.length, 8);
  assert.equal(manifest.projects[0].id, published.projects[0].id);
  assert.ok(manifest.files.some(f => f.path === 'public/cv.pdf'));
  assert.deepEqual(validatePlan(directory), manifest);
  assert.deepEqual(fs.readFileSync('data.json'), before);
  fs.appendFileSync(path.join(directory, 'public'+published.projects[0].image), 'tamper');
  assert.throws(() => validatePlan(directory), /checksum/);
});

test('backup verification rejects traversal and missing manifest references', () => {
  const { directory, manifest } = createPlan();
  manifest.files[0].path = '../outside';
  fs.writeFileSync(path.join(directory,'manifest.json'), JSON.stringify(manifest));
  assert.throws(() => validatePlan(directory), /Unexpected backup path/);
  const second = createPlan();
  second.manifest.files = second.manifest.files.filter(f => f.path !== 'public'+published.projects[0].image);
  fs.writeFileSync(path.join(second.directory,'manifest.json'), JSON.stringify(second.manifest));
  assert.throws(() => validatePlan(second.directory), /Missing referenced asset/);
});

test('migration planning rejects an asset symlink outside the repository', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'cms-source-test-'));
  fs.mkdirSync(path.join(root,'supabase/migrations'),{recursive:true});
  fs.mkdirSync(path.join(root,'lib/cms'),{recursive:true});
  fs.mkdirSync(path.join(root,'public/assets'),{recursive:true});
  fs.copyFileSync('lib/cms/portfolio.schema.json',path.join(root,'lib/cms/portfolio.schema.json'));
  const data = structuredClone(published);
  data.profile.profileImage = '/assets/escape.png';
  fs.writeFileSync(path.join(root,'data.json'),JSON.stringify(data));
  fs.symlinkSync(path.resolve('data.json'),path.join(root,'public/assets/escape.png'));
  assert.throws(() => createPlan(root), /escapes/);
});
