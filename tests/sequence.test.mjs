import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSequence, indexOfRoute, parentRoute } from '../public/js/sequence.js';
import { wings, portals, vision } from '../public/js/config.js';

const seq = buildSequence();

test('sequence follows the hierarchy', () => {
  assert.deepEqual(seq.slice(0, 2).map((s) => s.view), ['ndma', 'ngt']);
  assert.equal(seq.filter((s) => s.view === 'vision').length, vision.scenes.length);
  const firstWing = seq.findIndex((s) => s.view === 'wing');
  assert.equal(seq[firstWing - 1].view, 'wings');
  assert.equal(seq[firstWing + 1].view, 'portals');
  assert.equal(seq.length, 2 + vision.scenes.length + wings.length * 3 + portals.length);
});

test('every portal belongs to a wing and is reachable', () => {
  for (const p of portals) {
    assert.ok(wings.some((w) => w.id === p.wing), `${p.id} has unknown wing ${p.wing}`);
    const i = indexOfRoute(seq, { view: 'portal', wing: p.wing, portal: p.id });
    assert.equal(seq[i].portal, p.id);
  }
});

test('interactive routes map back onto the sequence (resume point)', () => {
  assert.equal(seq[indexOfRoute(seq, { view: 'wings' })].view, 'wings');
  assert.equal(seq[indexOfRoute(seq, { view: 'wing', wing: 'ai' })].wing, 'ai');
  assert.deepEqual(parentRoute({ view: 'portal', wing: 'ss', portal: 'x' }), { view: 'portals', wing: 'ss' });
});
