## `occurrences` without `Map`

**Priority:** P2
**Status:** open

### Problem

`occurrences` in [`../module.f.mjs`](../module.f.mjs) answers `indexOf` and
`lastIndexOf` over a list of names from one pass, with two `Map`s, so asking
either for every name is linear rather than quadratic. `new Map` is not
FunctionalScript, and it is the module's last construct of its own the
compiler refuses. Array repetition now comes from the independent
[`repeat`](../repeat/module.f.js) module, so it no longer brings a list
dependency into this module. Rewriting `occurrences` is the remaining
planned conversion work; check the complete module before renaming it to
`module.f.js`, then check its importers, including `fjs/rtti/module.f.mjs`.

### Direction

Build the two lookups as plain objects keyed by name and read them with
`entry`: `Object.fromEntries(positions)` keeps the later of two entries with
one key, as the `Map` does, so the positions in order give the last
occurrence and in reverse the first. `Object.fromEntries` is admitted, so
this rewrite needs no language extension. A spread with a computed key
would make the build quadratic, which is the cost this function exists
to avoid. Rewrite `occurrences`, then rename each complete module the
compiler accepts.
