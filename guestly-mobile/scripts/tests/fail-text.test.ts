// Run: node --experimental-strip-types scripts/tests/fail-text.test.ts
// Error toasts say what failed, then what to do (quality bar 4.5).
import assert from "node:assert/strict";
import { failText, TOO_LARGE } from "../../src/features/shared/failText.ts";
import { en } from "../../src/i18n/en.ts";
import { es } from "../../src/i18n/es.ts";

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

// A local failure (no network involved) keeps its own sentence: the photo
// picker's "Allow photo access" is status 0 but not offline.
const noPermission = f(0, "no_permission", "Allow photo access in Settings to pick a picture.", "Permite el acceso a fotos en Ajustes para elegir una imagen.");
assert.equal(failText("Could not add the photo.", noPermission, "en"), "Could not add the photo. Allow photo access in Settings to pick a picture.");
assert.equal(failText("No se pudo agregar la foto.", noPermission, "es"), "No se pudo agregar la foto. Permite el acceso a fotos en Ajustes para elegir una imagen.");
// A 413 from the host has no body: choose a smaller file.
assert.equal(failText("Could not upload the floor plan.", f(413, "http_413", "", ""), "en"), `Could not upload the floor plan. ${TOO_LARGE.en}`);

// The "what failed" sentences (copy.fail): one short sentence each, in both
// languages, naming the failure and nothing else (the reason comes after).
const keys = Object.keys(en.fail) as (keyof typeof en.fail)[];
assert.ok(keys.length >= 30, `${keys.length} fail keys`);
assert.deepEqual(Object.keys(es.fail).sort(), [...keys].sort());
for (const k of keys) {
  assert.match(en.fail[k], /^Could not [a-z][^.!?]*\.$/, `en fail.${k}: ${en.fail[k]}`);
  assert.match(es.fail[k], /^No se pud(o|ieron) [a-záéíóúñ][^.!?]*\.$/, `es fail.${k}: ${es.fail[k]}`);
  assert.equal(/\{(\w+)\}/.exec(en.fail[k])?.[1], /\{(\w+)\}/.exec(es.fail[k])?.[1], `fail.${k} placeholders`);
  for (const v of [en.fail[k], es.fail[k]]) assert.ok(!/[\u2013\u2014!]|Guestly/.test(v), v);
}
// The api's offline sentence never reaches a toast through failText.
for (const k of keys) assert.ok(!/retry|Reintentaremos/i.test(failText(en.fail[k], offline, "en") + failText(es.fail[k], offline, "es")));

// No dashes or exclamation marks in anything it adds.
for (const s of [failText("x", offline, "en"), failText("x", offline, "es"), failText("x", null, "en"), failText("x", null, "es")]) {
  assert.ok(!/[\u2013\u2014!]/.test(s), s);
}

console.log("fail-text: what failed, then what to do");
