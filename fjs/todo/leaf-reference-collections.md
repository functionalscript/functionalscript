## Replace Map and Set in the current leaf modules

**Priority:** P2
**Status:** wip

### Problem

The remaining leaf `module.f.mjs` files use native Map and Set constructors,
which the FJS compiler refuses.

### Scope

Replace the collection uses in these current leaves:

- `compiler/tokenizer`
- `edag/from_fast`
- `git/refstore`
- `js/ast/prepare`
- `js/ast/serializer`
- `js/marked`
- `media/datajs/vectors/matrix`
- `nanvm/demos/publish`
- `rust/serializer`
- `website/demo/graph`

Use the existing persistent map and set modules, including their RefMap-backed
reference indexes, or a simpler equivalent where the caller only needs a
membership check. Preserve reference identity, SameValueZero behavior where
observable, first-insertion order and last-value replacement for duplicate
map keys. Do not add native collection admission or change compiler semantics.

### Tasks

- [ ] Replace Map/Set uses and update affected internal types.
- [ ] Check collection-sensitive behavior with scoped proofs and coverage.
- [ ] Rename modules accepted whole to `.f.js` and repair references.
- [ ] Regenerate affected artifacts and run types, authored-module compilation
      and relevant consumer checks.
