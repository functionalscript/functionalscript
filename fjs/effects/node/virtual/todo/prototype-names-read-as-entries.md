## Inherited names read as entries in every operation but `stat`

**Priority:** P3
**Status:** open

### Problem

A `Dir` is a plain object, so `dir[name]` finds whatever `Object.prototype`
holds. `dir['toString']` is a function, which this file system reads as a
`JsModule`; `dir['__proto__']` is an object, which it reads as a directory. A
host has no such names, so every answer built from one models nothing.

`operation`'s descent and `statPath` now read **own** names only, through
`entryOf` in [`../module.f.mjs`](../module.f.mjs) — added with the `ENOTDIR`
mapping, because reading an inherited name there answered `ENOTDIR` ("the name
before this one exists") for `toString/x` under an empty root, where a host says
`ENOENT`. Every *other* operation still does its own lookup and still reads
through the prototype. Measured against `emptyState` after that fix:

| call | today | a host |
|---|---|---|
| `access('toString')` | `ok` — the path exists | `ENOENT` |
| `readFile('toString')` | throws `'toString' is a JsModule; readFile not supported` | `ENOENT` |
| `stat('toString')` | `ENOENT` | `ENOENT` |

The `readFile` row is the sharp one: a `throw` is not in the effect's channel at
all, so a program cannot answer it — and FunctionalScript has no `try`/`catch`
to contain it.

Nothing reaches this from FunctionalScript, where a `Dir` is a fixture the proof
author wrote: it takes a path naming an inherited property, which is why this is
filed rather than fixed under the pull request that found it
([#1751](https://github.com/functionalscript/functionalscript/pull/1751), where
the Codex review bot raised it).

### Proposal

Read every entry through `entryOf`. It is already there and already documents
why; what is left is the call sites, each a one-expression change:

`readFile`, `import_`, `writeFileOp`, `access`, `rmOp`, `extractEntity`,
`createExclusiveOp`, `writeBytesRawOp`, and `readBytes`'s own lookup.

`readdir` needs nothing — it walks `Object.entries`, which is own-only already,
and is the shape the others should be measured against.

### Tasks

- [ ] Route every entry lookup in `../module.f.mjs` through `entryOf`.
- [ ] Pin `access` and `readFile` against an inherited name from an empty root,
      beside `statOnInheritedName` in [`../proof.f.mjs`](../proof.f.mjs).
- [ ] Check whether any fixture in the repository relies on the current
      reading — none is expected, since it takes a deliberately chosen name.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `entryOf`, the fix, and the reason it
  exists.
- `fjs/effects/module.f.mjs` — its own note on a record whose keys reach
  `Object.prototype`, the same hazard in the memory runner's store.
