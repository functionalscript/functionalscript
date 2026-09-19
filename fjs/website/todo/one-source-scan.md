## one-source-scan. Every authored module is read twice by two identical folds, then again

**Priority:** P4
**Status:** open

### Problem

`proofModules` and `demoModules` in [`module.f.mjs`](../module.f.mjs) are
one text with one name changed:

```js
const proofModules = paths => foldStep(pureOk(paths), [], path => found => step(
    readUtf8File(path), source => pureOk(exportsProof(source) ? [...found, path] : found)))
const demoModules = paths => foldStep(pureOk(paths), [], path => found => step(
    readUtf8File(path), source => pureOk(exportsDemo(source) ? [...found, path] : found)))
```

`program` runs them back to back over the same list, so every authored
module is decoded twice, and `classify` → `readGraph` then reads the proof
and demo closures a third time from an empty graph. The abstraction
already exists one level down: `fjs/website/browser-source`'s
`exportsBinding` is "a function of the name because two conventions now
ask the same question of a module", with `exportsProof` and `exportsDemo`
as its two applications. The generator kept two folds instead of one
parameterised by the name. The module doc measures reading as the
program's whole cost.

### Proposal

One pass that reads each path once and answers everything the source can
answer — `{ proofs, demos, imports }`, via `exportsBinding('proof')`,
`exportsBinding('demo')` and `specifiers` of the string it already holds —
seeding `readGraph`'s graph with those imports so `classify` re-reads only
modules the scan did not visit.

### Tasks

- [ ] `scan` replacing `proofModules`/`demoModules`; `readGraph` accepts a
      seeded graph.
- [ ] `tsc`, `fjs test`; the generated site is byte-identical.

### Related

- [`../../text/todo/utf8-to-string-cost.md`](../../text/todo/utf8-to-string-cost.md) —
  the decoder's cost per read; counts one read per file.
