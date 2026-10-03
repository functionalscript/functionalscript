## same-bytes-home. `sameBytes` lives in `refname`, which most of its importers are not about

**Priority:** P5
**Status:** open

### Problem

[`fjs/git/refname`](../refname/module.f.mjs) exports `sameBytes`, a
re-binding of `sameItems`, and `object`'s `tryType`, `header`'s `isKey`,
`walk`, `ref` and `refstore` import it from there. An object type name
and a header key are not ref names; those modules depend on the ref-name
module for a byte comparison alone. [`fjs/git/bytes`](../bytes/module.f.mjs),
which describes itself as the fixed-width words and the prefix test,
already holds `startsWith` and is where a reader would look for it.

### Proposal

Move `sameBytes` to `fjs/git/bytes` next to `startsWith`; `refname`
imports it like everyone else.

### Tasks

- [ ] The move; the importers re-pointed.
- [ ] `tsc`, `fjs test`.

### Related

- [name-and-scope-modules](../refstore/todo/name-and-scope-modules.md) —
  names `sameBytes` as already shared; this is where it is shared from.
