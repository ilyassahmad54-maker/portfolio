const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const data = require('../data.json');
test('published portfolio retains all projects and deployable images', () => {
  assert.equal(data.projects.length, 8);
  assert.ok(data.projects.some(p => p.title.includes('RiskRadar')));
  const unemployment = data.projects.find(p => p.id === 'proj-1791656404798');
  assert.ok(unemployment);
  assert.equal(unemployment.category, 'Data Analytics & Viz');
  assert.equal(unemployment.githubUrl, 'https://github.com/ilyassahmad54-maker/codealpha_task');
  assert.equal(unemployment.demoUrl, 'https://labourlens-snbtordh3wynoppzmkj9uw.streamlit.app/');
  assert.equal(data.projects.find(p => p.id === 'proj-1791623262968').image, '/assets/riskradar-6b4d1ab9f5bdadbcf9ae.jpg');
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
