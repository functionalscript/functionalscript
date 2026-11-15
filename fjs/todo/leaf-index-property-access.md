# Make leaf indexes and property reads compile

**Status:** wip

Remaining `module.f.mjs` leaves contain computed indexes and prohibited property
accesses that the current FJS compiler refuses. Make numeric indexes explicit,
read enumerable own fields through `entry`, and replace unsupported iteration
methods while preserving their order and results.

## Tasks

- Fix computed indexes and prohibited properties in current leaves.
- Promote modules accepted whole to `.f.js` and update their references.
- Check newly exposed leaves for the same blockers and validate the changes.
