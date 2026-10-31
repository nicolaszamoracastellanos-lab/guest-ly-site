// Run: node --experimental-strip-types scripts/tests/wallet.test.ts
import assert from "node:assert/strict";
import { walletKindFor, walletUrl, walletAvailable } from "../../src/features/guest/wallet.ts";

assert.equal(walletKindFor("ios"), "apple");
assert.equal(walletKindFor("android"), "google");
assert.equal(walletKindFor("web"), null);
assert.equal(
  walletUrl("https://app.guest-ly.com/", "apple", "valentina-y-mateo", "de300000-0000-4000-8000-000000000001", "es"),
  "https://app.guest-ly.com/api/wallet/apple/valentina-y-mateo?g=de300000-0000-4000-8000-000000000001&lang=es"
);
assert.ok(walletUrl("http://localhost:3127", "google", "a b", "x", "en").includes("/api/wallet/google/a%20b?g=x&lang=en"));
assert.equal(walletAvailable(200), true);
assert.equal(walletAvailable(302), true);
assert.equal(walletAvailable(404), false);
assert.equal(walletAvailable(503), false);
console.log("wallet: ok");
