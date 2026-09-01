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
2. **Two index signatures without `?`.**
   `fjs/effects/node/virtual/types.ts` — `internet:
   { readonly[url: string]: Vec }` and `memoryValues:
   { readonly [key: string]: unknown }`. §6.2: without `?`, TypeScript types
   every access as `T` while the value can be `undefined` at runtime. The
   consumer proves it — `virtual/module.f.mjs:361-364` checks
   `result === undefined` on a read the type says is always a `Vec`. Both
   should be `StringMap<…>`. (The recursive `Dir` in the same file is the
   documented inline-form exception and stays.)

### Proposal

`Env = StringMap<string>`, `internet: StringMap<Vec>`,
`memoryValues: StringMap<unknown>`.

### Tasks

- [ ] Replace the three inline record types with `StringMap`
- [x] Mark `State` fields `readonly`; fix any compile fallout — done in
      functionalscript#1822, together with the repo-wide `readonly` rule in
      [AGENTS.md §3.2](../../AGENTS.md#32-types). `Dir` and `_Entity` in the
      same file already had `readonly`.

### Related

- [node-module-layering](../../todo/node-module-layering.md) — flags the
  `NodeProgramOptions.std` deviation only; these are the remaining ones
