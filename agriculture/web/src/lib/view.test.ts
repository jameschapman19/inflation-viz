import assert from 'node:assert/strict';
import test from 'node:test';
import { parseView, viewHash } from './view.ts';

const years = [1990, 1991, 1992];

test('parseView reads layer and year, defaulting sensibly', () => {
  assert.deepEqual(parseView('', years), { layer: 'production', year: 1992 });
  assert.deepEqual(parseView('#1991', years), { layer: 'production', year: 1991 });
  assert.deepEqual(parseView('#yield', years), { layer: 'yield', year: 1992 });
  assert.deepEqual(parseView('#change-1990', years), { layer: 'change', year: 1990 });
});

test('parseView ignores years and layers it does not know', () => {
  assert.deepEqual(parseView('#1800', years), { layer: 'production', year: 1992 });
  assert.deepEqual(parseView('#nonsense-1990', years), { layer: 'production', year: 1992 });
});

test('viewHash omits defaults and round-trips', () => {
  assert.equal(viewHash({ layer: 'production', year: 1992 }, 1992), '');
  assert.equal(viewHash({ layer: 'yield', year: 1992 }, 1992), 'yield');
  for (const view of [{ layer: 'production', year: 1990 }, { layer: 'change', year: 1991 }, { layer: 'yield', year: 1992 }] as const) {
    assert.deepEqual(parseView(`#${viewHash(view, 1992)}`, years), view);
  }
});
