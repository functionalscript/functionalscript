## Rename the subtraction member

**Priority:** P2
**Status:** wip

### Problem

`PrimeField.sub` shares a name with `String.prototype.sub`, so reading the
field operation through destructuring is refused by FunctionalScript.

### Tasks

- [ ] Rename the operation to `subtract` and update its type, callers and proofs.
- [ ] Check nonce reuse and promote it to `.f.js` if accepted.
- [ ] Run generation, type checking, scoped tests and coverage, and compilation.
