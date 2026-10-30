# Heavy-end demo presets

**Status:** wip

Add two sequences of thirty numbers to the monoid demo: 31 followed by 29 ones, and 29 ones followed by 31. Keep both deterministic and shareable, with Shuffle disabled.

## Tasks

- [x] Add the two options and sequence generation.
- [x] Extend the demo proofs for ordering, sums, rendered options, and shared links.
- [ ] Run TypeScript, the monoid proofs, and scoped proof coverage with the pinned toolchain; remove this issue after validation.

Validation is blocked in the current environment: mise is missing, and subsequent shell execution fails with `bwrap: setting up uid map: Read-only file system`.
