# Day pack fixtures (#30)

Recorded against the D1 contract in STUDY-app-offline Part D, before Lane 1's
portal routes exist (Nov 5 2026). Each file is one HTTP answer: `status`,
the headers the app reads, and the JSON body exactly as the mobile envelope
sends it. When Lane 1 merges, re-record them from the local stack
(couple@hh.local, planner@hh.local, the demo tenant) and the tests must pass
unchanged; any field they rename shows up here first.

Assumptions written into these files (also listed in the lane log):
- `data` is the pack itself (couple) or `{ pack }` (planner): the app reads both.
- `meta.version` is the content hash and the ETag is that hash in quotes.
- `meta.can_mark_status` is false when D28 keeps this person from marking blocks.
- The planner pack has `roster: null` without the `guests` view.
- Block status answers `423 runsheet_locked` (D28) and `404 not_found` for a deleted block.
- Check-in replays answer `already: true, replayed: true` (checkin-core.ts today).
