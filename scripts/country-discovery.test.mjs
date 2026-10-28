import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRY_OPTIONS, getCitySuggestions, normalizeCountryCode } from '../apps/web/src/utils/geoOptions.js';

test('country options are independent of tour inventory and include all 249 ISO destinations', () => {
  assert.equal(COUNTRY_OPTIONS.length, 249);
  assert.equal(new Set(COUNTRY_OPTIONS.map(item => item.code)).size, 249);
  for (const code of ['ZA', 'JP', 'KE', 'NZ', 'PE', 'EC', 'CO']) assert.ok(COUNTRY_OPTIONS.some(item => item.code === code));
});
test('South Africa names resolve to ZA rather than Somalia', () => {
  for (const name of ['South Africa', 'south africa', 'Sudáfrica', 'Sudafrica', 'Afrique du Sud', 'za']) assert.equal(normalizeCountryCode(name), 'ZA');
});
test('existing country names and aliases retain their canonical codes', () => {
  for (const [name, code] of [['Perú', 'PE'], ['PERU', 'PE'], ['Ecuador', 'EC'], ['Colombia', 'CO'], ['United States', 'US'], ['USA', 'US'], ['UK', 'GB']]) assert.equal(normalizeCountryCode(name), code);
});
test('unknown names do not silently become a different country', () => {
  assert.equal(normalizeCountryCode('Somewhere not a country'), '');
  assert.equal(normalizeCountryCode('ZZ'), '');
});
test('destinations without a curated city list never suggest Peruvian cities', () => {
  assert.deepEqual(getCitySuggestions('ZA'), []);
  assert.deepEqual(getCitySuggestions(''), []);
  assert.ok(getCitySuggestions('PE').includes('Lima'));
});
