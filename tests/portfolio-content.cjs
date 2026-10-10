const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const data = require('../data.json');
test('published portfolio retains all projects and deployable images', () => {
  assert.equal(data.projects.length, 7);
  assert.ok(data.projects.some(p => p.title.includes('RiskRadar')));
  assert.equal(new Set(data.projects.map(p => p.id)).size, data.projects.length);
  for (const image of [data.profile.profileImage, ...data.projects.map(p => p.image)]) {
    assert.ok(image.startsWith('/assets/'));
    assert.ok(fs.statSync(`public${image}`).size > 0);
  }
});
test('preparation rejects browser-local image URLs without changing published data', () => {
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-invalid-'));
  const invalid = structuredClone(data);
  invalid.projects[0].image = 'blob:https://example.com/temporary';
  const file = path.join(dir, 'invalid.json');
  fs.writeFileSync(file, JSON.stringify(invalid));
  const before = fs.readFileSync('data.json');
  assert.throws(() => execFileSync(process.execPath, ['scripts/prepare-portfolio.cjs', file], {stdio:'pipe'}));
  assert.deepEqual(fs.readFileSync('data.json'), before);
});
