## Compile numeric path indices

**Priority:** P3
**Status:** wip

### Problem

The compiler refuses `path`'s computed numeric indices, preventing its
conversion to `.f.js`.

### Proposal

Wrap numeric computed keys with `Number(...)`, preserving their values and
the existing path behavior.

### Tasks

- [ ] Update numeric computed keys and compile the whole module.
- [ ] Rename accepted modules to `.f.js` and update their references.
- [ ] Verify path proofs and refresh the conversion table.

### Related

- [Conversion audit](../../../../todo/fjs-nanvm-integration.md) — current leaves.
