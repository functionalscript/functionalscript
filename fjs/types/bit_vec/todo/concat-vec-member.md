## Rename the bit-vector concat member

**Priority:** P2
**Status:** wip

### Problem

`BitOrder.concat` shares a name with the built-in array and string member.
FunctionalScript allows calls of that name but refuses reading it as a value,
so `repeat` cannot pass `lsb.concat` directly to the monoid helper.

### Proposal

Rename the custom member to `concatVec` on both `lsb` and `msb`, updating
their callers and documentation. Keep `repeat`'s operation as a direct
function reference, without a wrapper or an `entry` lookup.

### Tasks

- [ ] Rename the member and update its types, callers, proofs and documentation.
- [ ] Check compiler acceptance and promote the module to `.f.js` if accepted.
- [ ] Run generation, type checking and the affected scoped checks.
