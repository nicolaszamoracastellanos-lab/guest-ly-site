// Run: node --experimental-strip-types scripts/tests/push-routes.test.ts
import assert from "node:assert/strict";
import { routeFor, tenantOf, PUSH_KEYS } from "../../src/lib/pushRoutes.ts";

// Existing sections still route as before.
assert.equal(routeFor({ route: "/couple/guests" }, "couple"), "/couple/guests");
assert.equal(routeFor({ route: "/couple/plan" }, "couple"), "/couple/tools");
assert.equal(routeFor({ route: "/couple/nope" }, "couple"), "/couple");
assert.equal(routeFor({ route: "/rsvps" }, "couple"), "/couple/rsvps");
assert.equal(routeFor({ route: "/planner/wedding" }, "planner"), "/planner/tools");
// A push for another surface opens this surface's home.
assert.equal(routeFor({ route: "/couple/guests", surface: "guest" }, "couple"), "/couple");
assert.equal(routeFor({ route: "/guest/rsvp" }, "couple"), "/couple");

// HH wave F: album, thank-you and pass.
assert.equal(routeFor({ route: "/couple/album" }, "couple"), "/couple/album");
assert.equal(routeFor({ route: "/couple/thankyou" }, "couple"), "/couple/thankyou");
assert.equal(routeFor({ route: "/guest/album" }, "guest"), "/guest/album");
assert.equal(routeFor({ route: "/guest/pass" }, "guest"), "/guest");
assert.equal(routeFor({ route: "/album" }, "couple"), "/couple/album");
assert.equal(routeFor({ route: "/settings/team?x=1" }, "couple"), "/couple/settings/team");
assert.equal(routeFor({ route: "/settings" }, "couple"), "/couple");
assert.equal(routeFor({ route: "/couple/settings/team" }, "couple"), "/couple/settings/team");
// Planners never land on a couple-only screen.
assert.equal(routeFor({ route: "/album" }, "planner"), "/planner");

// Keys: the new events are registered, the old ones kept.
assert.deepEqual([...PUSH_KEYS.couple], ["rsvps", "escalations", "tasks", "album", "team"]);
assert.deepEqual([...PUSH_KEYS.guest], ["dayof", "replies", "rsvp_reminder", "album", "pass"]);
assert.deepEqual([...PUSH_KEYS.planner], ["approvals", "tasks"]);

assert.equal(tenantOf({ tenant: "valentina-y-mateo" }), "valentina-y-mateo");
assert.equal(tenantOf({ tenant: "../x" }), null);

console.log("push-routes: ok");
