import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rootHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const saturdayHtml = fs.readFileSync(new URL('../saturday/index.html', import.meta.url), 'utf8');
const mainJs = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const stylesCss = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const ciWorkflow = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const deployWorkflow = fs.readFileSync(new URL('../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8');

test('root page includes skip link and live regions for dynamic status', () => {
  assert.match(rootHtml, /class="skip-link"/);
  assert.match(rootHtml, /href="#map-shell"/);
  assert.match(rootHtml, /id="day-history-status"[^>]*role="status"/);
  assert.match(rootHtml, /id="day-history-status"[^>]*aria-live="polite"/);
  assert.match(rootHtml, /id="status"[^>]*role="status"/);
});

test('saturday page includes skip link and screen-reader status announcements', () => {
  assert.match(saturdayHtml, /class="skip-link"/);
  assert.match(saturdayHtml, /href="#saturday-content"/);
  assert.match(saturdayHtml, /id="day-status"[^>]*role="status"/);
  assert.match(saturdayHtml, /id="copy-status"[^>]*role="status"/);
  assert.match(saturdayHtml, /aria-current", "page"/);
});

test('map export uses lazy html2canvas loading', () => {
  assert.doesNotMatch(mainJs, /import html2canvas from 'html2canvas';/);
  assert.match(mainJs, /html2canvasLoaderPromise/);
  assert.match(mainJs, /import\('html2canvas'\)/);
  assert.match(mainJs, /const html2canvas = await getHtml2Canvas\(\);/);
});

test('step selection focuses selected leg and legend explains solid vs dotted lines', () => {
  assert.match(mainJs, /fitToStep\(stepId\)/);
  assert.match(mainJs, /setFullDayPathMode\(false, false\)/);
  assert.match(mainJs, /setStatus\('Full day path shown\.'\)/);
  assert.match(mainJs, /Solid line: on-foot segment\./);
  assert.match(mainJs, /Dotted line: transit\/ride transfer or uploaded phone trace\./);
  assert.match(stylesCss, /\.legend-chip\.is-dashed/);
});

test('CI workflow enforces lint, typecheck, test, build, and dependency audit', () => {
  assert.match(ciWorkflow, /name:\s*CI/);
  assert.match(ciWorkflow, /pull_request:/);
  assert.match(ciWorkflow, /push:/);
  assert.match(ciWorkflow, /npm ci/);
  assert.match(ciWorkflow, /npm run lint/);
  assert.match(ciWorkflow, /npm run typecheck/);
  assert.match(ciWorkflow, /npm test/);
  assert.match(ciWorkflow, /npm run build/);
  assert.match(ciWorkflow, /npm audit --omit=dev --audit-level=high/);
});

test('deploy workflow uses reproducible dependency install and package scripts include typecheck', () => {
  assert.match(deployWorkflow, /run:\s*npm ci/);
  assert.equal(typeof packageJson?.scripts?.typecheck, 'string');
  assert.match(packageJson.scripts.typecheck, /node --check/);
});

test('mobile layout collapses itinerary panel and gives map full remaining height', () => {
  assert.match(rootHtml, /id="panel-toggle-btn"[^>]*aria-expanded/);
  assert.match(rootHtml, /aria-controls="itinerary-panel"/);
  assert.match(mainJs, /setPanelCollapsed\(/);
  assert.match(mainJs, /matchMedia\('\(max-width: 980px\)'\)/);
  assert.match(stylesCss, /height: 100dvh/);
  assert.match(stylesCss, /#itinerary-panel\.is-collapsed/);
});
