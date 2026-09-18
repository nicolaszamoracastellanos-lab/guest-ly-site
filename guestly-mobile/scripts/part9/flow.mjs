// Runs one Maestro flow and collects its screenshots where the audit wants them.
//
//   node scripts/part9/flow.mjs --device S --flow keyboard.yaml --to .part9/shots/S/es/couple/A4 \
//        --env TARGET_TEXT="Buscar invitados" --env NAME=C02-keyboard
//   node scripts/part9/flow.mjs --device S --flow scroll-shots.yaml --to .part9/shots/S/es/couple/A4 --env NAME=C11-more
//   node scripts/part9/flow.mjs --device S --flow open-sheet.yaml --to <dir> --env TARGET_ID=fab-add --env CLOSE=back --env NAME=C02-add
//
// Screenshot flows only. The sign-in flow types a password and must be run
// with maestro directly (see docs/PART9-HARNESS.md), so its run folder stays
// outside the repo and is deleted.

import path from "node:path";
import { ROOT, maestro, udidOf } from "./lib.mjs";

const argv = process.argv.slice(2);
const opt = { env: {} };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--env") {
    const kv = argv[++i] ?? "";
    const eq = kv.indexOf("=");
    if (eq > 0) opt.env[kv.slice(0, eq)] = kv.slice(eq + 1);
  } else if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[++i];
}
if (!opt.device || !opt.flow || !opt.to) {
  console.error("usage: flow.mjs --device <S|M|L|T|P|udid> --flow <file in .maestro> --to <folder for the PNGs> [--env KEY=VALUE]...");
  process.exit(2);
}
if (/signin/.test(opt.flow)) {
  console.error("refused: the sign-in flow types a password. Run it with maestro directly and delete ~/.maestro/tests afterwards.");
  process.exit(2);
}
const ok = maestro(udidOf(opt.device), opt.flow, opt.env, { shotsTo: path.resolve(ROOT, opt.to), verbose: true });
console.log(ok ? `flow passed, screenshots in ${opt.to}` : "flow FAILED");
process.exit(ok ? 0 : 1);
