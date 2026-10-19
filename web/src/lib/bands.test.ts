import assert from "node:assert/strict";
import test from "node:test";
import { bandForRate } from "./bands.ts";

test("rates fall into the four bands at their edges", () => {
  assert.equal(bandForRate(-0.1), "below-target");
  assert.equal(bandForRate(1.4), "below-target");
  assert.equal(bandForRate(1.5), "near-target");
  assert.equal(bandForRate(2.0), "near-target");
  assert.equal(bandForRate(2.5), "near-target");
  assert.equal(bandForRate(2.6), "elevated");
  assert.equal(bandForRate(5.0), "elevated");
  assert.equal(bandForRate(5.1), "high");
  assert.equal(bandForRate(11.1), "high");
});
