## Bring the node/virtual types onto the record-type rules

**Priority:** P3
**Status:** open

### Problem

Two deviations from rules AGENTS.md states explicitly (a third, `State`'s
fields all being mutable, is fixed — see Tasks):

1. **`Env` re-rolls `StringMap` in a file that already imports it.**
   `fjs/effects/node/types.ts:291-293` spells out
   `{ readonly [k: string]: string|undefined }` — that is
   `StringMap<string>`, imported at `:12` and used two lines apart for
   `Headers` and `Module`.
2. **An index signature without `?`.**
   `fjs/effects/node/virtual/types.ts` — `internet:
   { readonly[url: string]: Vec }`. §6.2: without `?`, TypeScript types
   every access as `T` while the value can be `undefined` at runtime. The
   consumer proves it — `fetch` in `virtual/module.f.mjs` checks
   `result === undefined` on a read the type says is always a `Vec`. It
   should be `StringMap<Vec>`. (The recursive `Dir` in the same file is the
   documented inline-form exception and stays. `memoryValues`, the second
   one, is gone: the memory slots are `fjs/effects/memory`'s `MemoryState`,
   whose `values` is already a `StringMap<unknown>`.)

### Proposal

`Env = StringMap<string>`, `internet: StringMap<Vec>`.

### Tasks

- [ ] Replace the two inline record types with `StringMap`
- [x] Mark `State` fields `readonly`; fix any compile fallout — done in
      functionalscript#1822, together with the repo-wide `readonly` rule in
      [AGENTS.md §3.2](../../../AGENTS.md#32-types). `Dir` and `_Entity` in the
      same file already had `readonly`.

### Related

- [node-module-layering](../../todo/node-module-layering.md) — flags the
  `NodeProgramOptions.std` deviation only; these are the remaining ones
