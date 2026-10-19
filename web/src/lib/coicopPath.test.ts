import assert from "node:assert/strict";
import test from "node:test";
import { coicopFromSlug, coicopSlug } from "./coicopPath.ts";

test("a slash becomes an underscore and back", () => {
  assert.equal(coicopSlug("01.1.1.7/8"), "01.1.1.7_8");
  assert.equal(coicopFromSlug("01.1.1.7_8"), "01.1.1.7/8");
});

test("ordinary codes are unchanged, so existing URLs keep working", () => {
  for (const code of ["01", "07.2", "07.2.2", "01.1.1.1"]) {
    assert.equal(coicopSlug(code), code);
    assert.equal(coicopFromSlug(code), code);
  }
});
