import test from "node:test";
import assert from "node:assert/strict";
import { createDialGesture } from "../src/engine/gesture.js";
test("putting down a finger does not move anything", () => {
  const g = createDialGesture();
  assert.equal(g.begin(1, 75), true);
  assert.deepEqual(g.move(1, 75), { delta: 0, uncertain: false });
});
test("release, re-grab and switching blade grips preserve position", () => {
  const g = createDialGesture();
  g.begin(1, 10);
  assert.equal(g.move(1, 20).delta, 10);
  assert.equal(g.end(1), true);
  g.begin(2, 260);
  assert.equal(g.move(2, 270).delta, 10);
});
test("second finger cannot hijack a gesture or end it", () => {
  const g = createDialGesture();
  g.begin(1, 0);
  assert.equal(g.begin(2, 120), false);
  assert.equal(g.move(2, 180).delta, 0);
  assert.equal(g.end(2), false);
  assert.equal(g.move(1, 15).delta, 15);
});
test("multiple revolutions do not wrap tracked total", () => {
  const g = createDialGesture();
  g.begin(1, 0);
  let total = 0;
  for (let i = 1; i <= 1080; i++) total += g.move(1, i % 360).delta;
  assert.equal(total, 1080);
});
test("clockwise zero crossing then reverse movement", () => {
  const g = createDialGesture();
  g.begin(1, 359);
  assert.equal(g.move(1, 0).delta, 1);
  assert.equal(g.move(1, 359).delta, -1);
});
test("pointer cancel/lost capture can release state safely", () => {
  const g = createDialGesture();
  g.begin(1, 0);
  assert.equal(g.end(1), true);
  assert.equal(g.end(1), false);
  assert.equal(g.move(1, 90).delta, 0);
  assert.equal(g.begin(2, 100), true);
});
test("center dead zone suspends angular motion and marks uncertainty", () => {
  const g = createDialGesture();
  g.begin(1, 0);
  assert.equal(g.move(1, null).uncertain, true);
  assert.equal(g.move(1, 180).delta, 0);
  assert.equal(g.move(1, 185).delta, 5);
});
test("ambiguous large movements mark sync uncertain", () => {
  const g = createDialGesture();
  g.begin(1, 0);
  assert.deepEqual(g.move(1, 170), { delta: 0, uncertain: true });
});
test("right mouse button is ignored", () => {
  const g = createDialGesture();
  assert.equal(g.begin(1, 10, 2), false);
  assert.equal(g.begin(2, null), false);
});
