// Run: node --experimental-strip-types scripts/tests/settings.test.ts
import assert from "node:assert/strict";
import { zoneGroups, zoneCity, validZone, generalPatch, applyPrefChange, hourLabel, openInvites, looksLikeEmail, capShare, groupConnections, needSetup, devicePushPrefs, connectionsWebPath, connectionsSummary, personLabel, avatarInitials } from "../../src/features/settings/logic.ts";

// Time zones: city names, accent-insensitive search, pinned zones first.
assert.equal(zoneCity("America/Argentina/Buenos_Aires"), "Buenos Aires");
assert.equal(zoneCity("UTC"), "UTC");
const paz = zoneGroups("paz", "es");
assert.equal(paz.length, 1);
assert.deepEqual(paz[0].zones, ["America/La_Paz"]);
assert.equal(paz[0].title, "América");
assert.deepEqual(zoneGroups("sao", "en")[0].zones, ["America/Sao_Paulo"]);
const pinned = zoneGroups("", "en", ["Asia/Kolkata", "America/La_Paz", null]);
assert.equal(pinned[0].key, "pinned");
assert.deepEqual(pinned[0].zones, ["Asia/Kolkata", "America/La_Paz"]);
assert.ok(!pinned[1].zones.includes("America/La_Paz"));
assert.deepEqual(zoneGroups("zzzz", "en"), []);
assert.equal(validZone("Europe/Madrid"), true);
assert.equal(validZone("not a zone"), false);

// General: only what changed, empty strings become null, names kept as typed.
const base = { couple_names: "Valentina & Mateo", wedding_date: "2027-03-20", wedding_city: "La Paz", venue_booked: false, timezone: "America/La_Paz", locale_default: "es" as const };
assert.deepEqual(generalPatch(base, { ...base }), {});
assert.deepEqual(generalPatch(base, { ...base, wedding_city: "  " }), { wedding_city: null });
assert.deepEqual(generalPatch(base, { ...base, venue_booked: true, wedding_date: null }), { wedding_date: null, venue_booked: true });
assert.deepEqual(generalPatch(base, { ...base, couple_names: "" }), { couple_names: "" });

// Preferences: one change at a time, cells the event lacks never appear.
const prefs = {
  events: [
    { key: "rsvp_new", channels: { email: true, push: true, bell: true }, mode: "instant" as const },
    { key: "weekly_digest", channels: { email: true } },
  ],
  rsvp_mode: "instant" as const,
  quiet_hours: null,
  marketing: { event: "lifecycle", consent: false, unsubscribed: true },
};
assert.equal(applyPrefChange(prefs, { event: "rsvp_new", channel: "push", enabled: false }).events[0].channels.push, false);
assert.equal("push" in applyPrefChange(prefs, { event: "weekly_digest", channel: "push", enabled: true }).events[1].channels, false);
const daily = applyPrefChange(prefs, { event: "rsvp_new", mode: "daily" });
assert.equal(daily.rsvp_mode, "daily");
assert.equal(daily.events[0].mode, "daily");
assert.deepEqual(applyPrefChange(prefs, { quiet_hours: { start: 22, end: 8 } }).quiet_hours, { start: 22, end: 8 });
assert.deepEqual(applyPrefChange(prefs, { marketing: true }).marketing, { event: "lifecycle", consent: true, unsubscribed: false });
assert.equal(hourLabel(7), "07:00");
assert.equal(hourLabel(24), "00:00");

// Push on this phone follows the Push cells; phone-only keys keep their value.
const evs = [
  { key: "rsvp_new", channels: { push: false } },
  { key: "escalation", channels: { push: false } },
  { key: "request_new", channels: { push: true } },
  { key: "task_due", channels: { push: true } },
  { key: "weekly_digest", channels: { email: true } },
];
assert.deepEqual(devicePushPrefs("couple", evs, { album: false, rsvps: true }), { album: false, rsvps: false, escalations: true, tasks: true });
assert.deepEqual(devicePushPrefs("planner", evs, {}), { approvals: true, tasks: true });

// Team, billing, connections.
assert.equal(openInvites([{ status: "pending" }, { status: "expired" }, { status: "pending" }]), 2);
assert.equal(openInvites(undefined), 0);
assert.equal(looksLikeEmail(" ana@correo.com "), true);
assert.equal(looksLikeEmail("ana@correo"), false);
assert.equal(capShare(80, 160), 0.5);
assert.equal(capShare(200, 160), 1);
assert.equal(capShare(10, null), null);
const items = [
  { provider: "stripe", category: "payments", status: "connected" as const },
  { provider: "whatsapp", category: "messaging", status: "needs_attention" as const },
  { provider: "x", category: "future", status: "not_set_up" as const },
];
const groups = groupConnections(items, [
  { key: "messaging", name: "Messaging" },
  { key: "calendar_wallet", name: "Calendar" },
  { key: "payments", name: "Payments" },
]);
assert.deepEqual(groups.map((g) => g.key), ["messaging", "payments", "future"]);
assert.equal(groups[2].name, "future");
assert.equal(needSetup(items), 2);
// Managed connections (Guest-ly switches them on) are never the couple's to set up.
assert.equal(needSetup([...items, { provider: "sms", category: "messaging", status: "not_set_up" as const, managed: true }]), 2);

// The summary is the server's sentence, the same one the web shows; null when an older server sends none.
assert.equal(connectionsSummary({ summary_line: "4 connected, 3 not set up" }), "4 connected, 3 not set up");
assert.equal(connectionsSummary({ summary_line: "  " }), null);
assert.equal(connectionsSummary({}), null);

// A person without a name shows the full address and one neutral letter, never the local part as a name.
assert.deepEqual(personLabel("Valentina", "Ríos", "couple@hh.local"), { label: "Valentina Ríos", named: true });
assert.deepEqual(personLabel(null, " ", "couple@hh.local"), { label: "couple@hh.local", named: false });
assert.equal(avatarInitials("Valentina Ríos", true), "VR");
assert.equal(avatarInitials("couple@hh.local", false), "C");

// The setup link exists on every portal build (integrations, or its redirect to connections).
assert.equal(connectionsWebPath("couple"), "/settings/integrations");
assert.equal(connectionsWebPath("planner"), "/planner/settings/integrations");

console.log("settings: ok");
