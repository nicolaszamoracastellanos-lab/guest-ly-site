// Run: node --experimental-strip-types scripts/tests/layout.test.ts
import assert from "node:assert/strict";
import { bucketFor, columnsFor, listWidthFor, openness, poseFor, twoPaneFor } from "../../src/ui/layoutMath.ts";

// Buckets at every measured Duo canvas and the Split View halves.
const cases: [number, string][] = [[335, "narrow"], [399, "narrow"], [402, "compact"], [466, "compact"], [475, "compact"], [599, "compact"], [600, "regular"], [669, "regular"], [678, "regular"], [899, "regular"], [900, "wide"], [951, "wide"]];
for (const [w, b] of cases) assert.equal(bucketFor(w), b, `bucket ${w}`);

// Two panes: regular and wide, except regular with large accessibility type.
assert.equal(twoPaneFor("narrow", false), false);
assert.equal(twoPaneFor("compact", false), false);
assert.equal(twoPaneFor("regular", false), true);
assert.equal(twoPaneFor("regular", true), false);
assert.equal(twoPaneFor("wide", true), true);

// Even columns whenever the grid has room; one column for large type.
assert.equal(columnsFor("wide", false), 4);
assert.equal(columnsFor("regular", false), 2);
assert.equal(columnsFor("compact", false), 2);
assert.equal(columnsFor("narrow", false), 1);
assert.equal(columnsFor("wide", true), 1);
assert.equal(listWidthFor("wide"), 320);
assert.equal(listWidthFor("regular"), 300);

// Pose inference.
const H = (status: "closed" | "partiallyOpen" | "fullyOpen" | "unknown", angle = 90) => ({ status, angle });
assert.equal(poseFor(null, 466, 678), "flat");
assert.equal(poseFor(undefined, 951, 669), "flat");
assert.equal(poseFor(H("closed", 0), 466, 678), "closed");
assert.equal(poseFor(H("fullyOpen", 180), 669, 951), "flat");
assert.equal(poseFor(H("partiallyOpen", 110), 951, 669), "book");
assert.equal(poseFor(H("partiallyOpen", 110), 669, 951), "table");
assert.equal(poseFor(H("partiallyOpen", 110), 678, 466), "tent");
assert.equal(poseFor(H("unknown"), 669, 951), "flat");

// Openness for effects: clamped 0..1, 1 when there is no hinge.
assert.equal(openness(null), 1);
assert.equal(openness(H("partiallyOpen", 0)), 0);
assert.equal(openness(H("partiallyOpen", 180)), 1);
assert.ok(Math.abs(openness(H("partiallyOpen", 90)) - 0.5) < 1e-9);

console.log("layout.test.ts: all assertions passed");
