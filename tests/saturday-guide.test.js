import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const guidePath = path.resolve('saturday/index.html');
const readGuide = () => fs.readFileSync(guidePath, 'utf8');

test('saturday guide file exists', () => {
  assert.equal(fs.existsSync(guidePath), true);
});

test('required stops appear in correct order', () => {
  const html = readGuide();
  const stopsStart = html.indexOf('<h2>Stops</h2>');
  const stopsEnd = html.indexOf('<h2>Transit by major leg</h2>');
  const stopsSection = html.slice(stopsStart, stopsEnd);

  const stops = [
    'Brooklyn Bridge (Manhattan entrance near City Hall)',
    'Destination: Wall St/Pier 11',
    'The Ten Bells',
    'Reset at hotel',
    'New York Comedy Club - Midtown',
    'Frank',
  ];

  let lastIndex = -1;
  for (const stop of stops) {
    const idx = stopsSection.indexOf(stop);
    assert.notEqual(idx, -1, `Missing stop: ${stop}`);
    assert.ok(idx > lastIndex, `Stop out of order: ${stop}`);
    lastIndex = idx;
  }
});

test('required exact addresses are present', () => {
  const html = readGuide();

  assert.match(html, /247 Broome St, New York, NY 10002/);
  assert.match(html, /88 2nd Ave, New York, NY 10003/);
  assert.match(html, /241 E 24th St, New York, NY 10010/);
  assert.match(html, /119 W 56th St, New York, NY 10019/);
});

test('ferry landing names and destination are present', () => {
  const html = readGuide();

  assert.match(html, /DUMBO\/Fulton Ferry/);
  assert.match(html, /Brooklyn Bridge Park/);
  assert.match(html, /Wall St\/Pier 11/);
  assert.match(html, /11 South St, New York, NY 10004/);
});

test('consolidated maps link includes ordered route segments', () => {
  const html = readGuide();
  const hrefMatch = html.match(/id="all-stops-link"[^>]*href="([^"]+)"/);

  assert.ok(hrefMatch, 'Missing all-stops-link href');
  const href = hrefMatch[1];

  assert.match(href, /origin=Thompson\+Central\+Park\+New\+York/);
  assert.match(href, /Brooklyn\+Bridge\+Pedestrian\+Walkway\+Entrance\+near\+City\+Hall/);
  assert.match(href, /Pier\+11\+Wall\+St/);
  assert.match(href, /The\+Ten\+Bells/);
  assert.match(href, /New\+York\+Comedy\+Club\+Midtown/);
  assert.match(href, /destination=Frank/);
});

test('day history tabs and upload controls are present', () => {
  const html = readGuide();

  assert.match(html, /id="day-tabs"/);
  assert.match(html, /id="upload-day-path-btn"/);
  assert.match(html, /id="upload-day-path-input"/);
});

test('saturday guide includes view-on-map uploaded day link pattern', () => {
  const html = readGuide();
  assert.match(html, /\/\?day=/);
});
