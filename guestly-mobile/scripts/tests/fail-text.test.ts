// Run: node --experimental-strip-types scripts/tests/fail-text.test.ts
// Error toasts say what failed, then what to do (quality bar 4.5).
import assert from "node:assert/strict";
import { failText } from "../../src/features/shared/failText.ts";

const what = { en: "Publish failed. Nothing changed for your guests.", es: "La publicación falló. Nada cambió para tus invitados." };
const f = (status: number, code: string, en: string, es: string) => ({ status, code, messages: { en, es } });

// Never reached the server: the connection, and no promise of a retry.
const offline = f(0, "offline", "You seem to be offline. We will retry when the connection is back.", "Parece que no tienes conexión. Reintentaremos cuando vuelva.");
assert.equal(failText(what.en, offline, "en"), "Publish failed. Nothing changed for your guests. Check your connection and try again.");
assert.equal(failText(what.es, offline, "es"), "La publicación falló. Nada cambió para tus invitados. Revisa tu conexión e inténtalo de nuevo.");
assert.match(failText(what.en, f(0, "timeout", "x", "x"), "en"), /Check your connection/);

// The server's own reason is kept.
const refused = f(403, "forbidden", "Only owners and admins can publish.", "Solo los dueños y administradores pueden publicar.");
assert.equal(failText(what.en, refused, "en"), `${what.en} Only owners and admins can publish.`);
assert.equal(failText(what.es, refused, "es"), `${what.es} Solo los dueños y administradores pueden publicar.`);

// The generic server sentence, an empty one, or a non-API error: try again.
assert.equal(failText(what.en, f(500, "server_error", "Something went wrong. Please try again.", "Algo salió mal. Inténtalo de nuevo."), "en"), `${what.en} Try again.`);
assert.equal(failText(what.es, f(500, "server_error", "Something went wrong. Please try again.", "Algo salió mal. Inténtalo de nuevo."), "es"), `${what.es} Inténtalo de nuevo.`);
assert.equal(failText(what.en, f(502, "http_502", "", ""), "en"), `${what.en} Try again.`);
assert.equal(failText("Could not make a new code.", null, "en"), "Could not make a new code. Try again.");
assert.equal(failText("No se pudo generar un código nuevo.", null, "es"), "No se pudo generar un código nuevo. Inténtalo de nuevo.");

// No dashes or exclamation marks in anything it adds.
for (const s of [failText("x", offline, "en"), failText("x", offline, "es"), failText("x", null, "en"), failText("x", null, "es")]) {
  assert.ok(!/[\u2013\u2014!]/.test(s), s);
}

console.log("fail-text: what failed, then what to do");
