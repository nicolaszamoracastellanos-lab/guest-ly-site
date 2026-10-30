// Run: node --experimental-strip-types scripts/tests/contacts.test.ts
import assert from "node:assert/strict";
import { cleanPhone, bestPhone, pickerFor, fromPickerContact } from "../../src/features/guests/contactsMath.ts";

assert.equal(cleanPhone("+52 (646) 555-1234"), "+526465551234");
assert.equal(cleanPhone("0052 646 555 1234"), "+526465551234");
assert.equal(cleanPhone("646.555.1234"), "6465551234");
assert.equal(cleanPhone("  "), null);
assert.equal(cleanPhone(null), null);

// A mobile number wins over home or work, in English or Spanish labels.
assert.equal(bestPhone([{ label: "home", number: "+1 212 555 0000" }, { label: "mobile", number: "+1 917 555 1111" }]), "+19175551111");
assert.equal(bestPhone([{ label: "casa", number: "4 444 4444" }, { label: "Celular", number: "+591 7000 0000" }]), "+59170000000");
assert.equal(bestPhone([{ label: "work", number: "+1 646 555 2222" }]), "+16465552222");
assert.equal(bestPhone([{ label: "mobile", number: "" }]), null);
assert.equal(bestPhone(undefined), null);

// No access state ever leads to the permission prompt: only limited access
// uses the access picker; everything else gets the no-permission system picker.
assert.equal(pickerFor("limited"), "access");
assert.equal(pickerFor("undetermined"), "system");
assert.equal(pickerFor("none"), "system");
assert.equal(pickerFor("all"), "system");
assert.equal(pickerFor("unavailable"), "none");

// The system picker's person, as the form needs it.
assert.deepEqual(
  fromPickerContact({ id: "x1", name: "  Ana   María López ", phoneNumbers: [{ label: "home", number: "4 444 4444" }, { label: "mobile", number: "+591 7000 0000" }], emails: [{ email: "" }, { email: " ana@example.com " }] }),
  { id: "x1", name: "Ana María López", phone: "+59170000000", email: "ana@example.com" }
);
// No full name: first and last; no phones or emails: nulls.
assert.deepEqual(fromPickerContact({ id: "x2", firstName: "Luis", lastName: "Paz" }), { id: "x2", name: "Luis Paz", phone: null, email: null });
// Nothing to call the guest: skipped.
assert.equal(fromPickerContact({ id: "x3", name: " ", phoneNumbers: [{ number: "+1 212 555 0000" }] }), null);
assert.equal(fromPickerContact(null), null);

console.log("contacts.test.ts: ok");
