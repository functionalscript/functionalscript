## `occurrences` in a module the compiler accepts

**Priority:** P2
**Status:** open

### Problem

`occurrences` in [`../module.f.mjs`](../module.f.mjs) answers `indexOf` and
`lastIndexOf` over a list of names from one pass, so asking either for every
name is linear rather than quadratic. It no longer builds `Map`s: two plain
objects from `Object.fromEntries`, read with `entry`, keep the later of two
entries with one key, as a `Map` did. Array repetition comes from the
independent [`repeat`](../repeat/module.f.js) module.

The module is still not one the compiler accepts, so it cannot be renamed
to `module.f.js`, and its importers, including `fjs/rtti/module.f.mjs`, wait
on it. The first refusal is now `occurrences`' own answer: its fields are
named `indexOf` and `lastIndexOf`, which are `Array.prototype` names, and the
compiler refuses every prototype name as a property key
([spec: property accessor](../../../../spec/todo/2330-property-accessor.md)).

### Direction

Rename the two fields of `Occurrences` (`types.ts`) to names that are no
prototype's and update the callers, most of them proofs, then compile the
module and rename it if nothing else is refused.

### Tasks

- [x] Build the two lookups as plain objects and read them with `entry`.
- [ ] Rename `Occurrences`' fields; update every caller.
- [ ] Rename the module to `module.f.js` once the compiler accepts it; check
      its importers.
