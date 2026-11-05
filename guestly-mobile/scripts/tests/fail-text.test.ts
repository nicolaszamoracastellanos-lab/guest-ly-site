// Run: node --experimental-strip-types scripts/tests/fail-text.test.ts
// Error toasts say what failed, then what to do (quality bar 4.5).
import assert from "node:assert/strict";
import { failText, noAnswer, TOO_LARGE, UNKNOWN } from "../../src/features/shared/failText.ts";
import { en } from "../../src/i18n/en.ts";
import { es } from "../../src/i18n/es.ts";

const what = { en: "Publish failed. Nothing changed for your guests.", es: "La publicación falló. Nada cambió para tus invitados." };
const f = (status: number, code: string, en: string, es: string) => ({ status, code, messages: { en, es } });

// Offline (no device report, or the device says offline): never reached the
// server, so the connection, and no promise of a retry.
const offline = f(0, "offline", "You seem to be offline. We will retry when the connection is back.", "Parece que no tienes conexión. Reintentaremos cuando vuelva.");
assert.equal(failText(what.en, offline, "en"), "Publish failed. Nothing changed for your guests. Check your connection and try again.");
assert.equal(failText(what.es, offline, "es"), "La publicación falló. Nada cambió para tus invitados. Revisa tu conexión e inténtalo de nuevo.");
// The device said it was offline: nothing left the phone, the same toast.
assert.equal(failText(what.en, offline, "en", { online: false }), "Publish failed. Nothing changed for your guests. Check your connection and try again.");

// No answer came back (a timeout, or a network error while online): a write
// may have landed, so the toast never says it failed or invites a plain retry
// (a second guest, a second message). Brain's "Nothing changed" goes too.
const timeout = f(0, "timeout", "This is taking longer than usual. Please try again in a moment.", "Esto está tardando más de lo normal. Inténtalo de nuevo en un momento.");
for (const opts of [{}, { online: true }, { online: false }]) {
  assert.equal(failText(what.en, timeout, "en", opts), UNKNOWN.en);
  assert.equal(failText(what.es, timeout, "es", opts), UNKNOWN.es);
}
assert.equal(failText(what.en, offline, "en", { online: true }), UNKNOWN.en);
assert.equal(failText(what.es, offline, "es", { online: true }), UNKNOWN.es);
for (const lang of ["en", "es"] as const) {
  for (const s of [failText(what[lang], timeout, lang), failText("Could not add the guest.", timeout, lang), failText("No se pudo agregar al invitado.", offline, lang, { online: true })]) {
    assert.ok(!/^(Could not|No se pud)/.test(s), s);
    assert.ok(!/Nothing changed|Nada cambió|Check your connection|Revisa tu conexión/.test(s), s);
    assert.ok(/check before|revisa antes/i.test(s), s);
  }
}
assert.ok(noAnswer(timeout) && noAnswer(offline, { online: true }));
assert.ok(!noAnswer(offline) && !noAnswer(offline, { online: false }) && !noAnswer(null));
// A read is safe to repeat: the connection sentence stays.
assert.equal(failText("Could not open the guest.", timeout, "en", { read: true, online: true }), "Could not open the guest. Check your connection and try again.");
assert.equal(failText("No se pudo abrir al invitado.", offline, "es", { read: true, online: true }), "No se pudo abrir al invitado. Revisa tu conexión e inténtalo de nuevo.");
// A server answer is an answer, whatever the device says.
assert.equal(failText(what.en, f(500, "server_error", "", ""), "en", { online: true }), `${what.en} Try again.`);

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
for (const s of [failText("x", offline, "en"), failText("x", offline, "es"), failText("x", null, "en"), failText("x", null, "es"), UNKNOWN.en, UNKNOWN.es]) {
  assert.ok(!/[\u2013\u2014!]/.test(s), s);
}

console.log("fail-text: what failed, then what to do");
