# Day pack fixtures (#30)

Two sets. Each file is one HTTP answer: `status`, the headers the app reads,
and the JSON body exactly as the mobile envelope sends it.

- `local-*.json`: recorded from Lane 1's routes on the local stack (integration
  793c44b9, Nov 7 2026) by `day-pack-contract.test.ts` with `GL_RECORD=1`,
  MW_DAY_PACK on for the run (couple@hh.local, planner@hh.local, a guest of the
  demo wedding). day-pack.test.ts parses them. Re-record with the same command
  whenever the portal's pack or status routes change.
- The other files: the scenario fixtures written against the D1 contract
  before Lane 1's routes existed (Nov 5 2026). They keep hand-made moments
  (the mockup's 16:12 day) that the Now/Next and outbox tests rely on, so they
  are not overwritten. Their shapes match the recorded answers, with two
  differences the parser handles: the planner route sends the pack bare (the
  scenario file wraps it in `{ pack }`), and real blocks also carry
  `vendor_name` and `kind`.

Assumptions written into these files (also listed in the lane log):
- `data` is the pack itself (couple) or `{ pack }` (planner): the app reads both.
- `meta.version` is the content hash and the ETag is that hash in quotes.
- `meta.can_mark_status` is false when D28 keeps this person from marking blocks.
- The planner pack has `roster: null` without the `guests` view.
- Block status answers `423 runsheet_locked` (D28) and `404 not_found` for a deleted block.
- Check-in replays answer `already: true, replayed: true` (checkin-core.ts today).
