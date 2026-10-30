// Run: node --experimental-strip-types scripts/tests/contacts.test.ts
import assert from "node:assert/strict";
import { cleanPhone, bestPhone } from "../../src/features/guests/contactsMath.ts";

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

console.log("contacts.test.ts: ok");
