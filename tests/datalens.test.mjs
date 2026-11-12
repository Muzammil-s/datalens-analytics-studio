import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCSV,
  serializeCSV,
  profileDataset,
  cleanDataset,
  pearsonCorrelation,
  generateMarkdownReport
} from '../src/csvEngine.js';

const SAMPLE = `id,category,score,amount
1,Web,80,100
2,Web,90,120
2,Web,90,120
3,Sec,,140
4,Data,100,160`;

test('parseCSV handles standard CSV and round-trips via serializeCSV', () => {
  const { headers, records } = parseCSV(SAMPLE);
  assert.deepEqual(headers, ['id', 'category', 'score', 'amount']);
  assert.equal(records.length, 5);
  const reserialized = serializeCSV(headers, records);
  assert.equal(parseCSV(reserialized).records.length, 5);
});

test('profileDataset identifies duplicates, missing cells, and numeric statistics', () => {
  const { headers, records } = parseCSV(SAMPLE);
  const profile = profileDataset(headers, records);
  assert.equal(profile.duplicateRows, 1);
  assert.equal(profile.totalMissing, 1);
  const scoreCol = profile.columns.find((c) => c.name === 'score');
  assert.equal(scoreCol.type, 'numeric');
  assert.equal(scoreCol.stats.median, 90);
});

test('cleanDataset removes duplicates and imputes missing numeric values', () => {
  const { headers, records } = parseCSV(SAMPLE);
  const cleaned = cleanDataset(headers, records, {
    trimWhitespace: true,
    removeDuplicates: true,
    missingStrategy: 'impute',
    numericImpute: 'median'
  });
  assert.equal(cleaned.records.length, 4);
  assert.equal(cleaned.records[2].score, '90');
});

test('pearsonCorrelation and markdown report generation work accurately', () => {
  const { headers, records } = parseCSV(SAMPLE);
  const r = pearsonCorrelation(records, 'score', 'amount');
  assert.equal(r, 0.973);
  const md = generateMarkdownReport('Test CSV', profileDataset(headers, records), ['Removed 1 duplicate']);
  assert.ok(md.includes('DataLens Analytics Report'));
});
