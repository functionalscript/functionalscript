## Bring the node/virtual types onto the record-type rules

**Priority:** P3
**Status:** open

### Problem

Three deviations from rules AGENTS.md states explicitly:

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
3. **`State`'s fields are all mutable.** `virtual/types.ts:28-41` — no
   `readonly` on `stdout`, `stderr`, `stdin`, `root`, `internet`, `epochNs`,
   `memoryNext`, `memoryValues`, `randomNext`, while every operation rebuilds
   the record by spread. The mutability is unused and unenforced; `Dir` and
   `_Entity` in the same file already have `readonly`.

### Proposal

`Env = StringMap<string>`, `internet: StringMap<Vec>`,
`memoryValues: StringMap<unknown>`, and `readonly` on every `State` field.

### Tasks

- [ ] Replace the three inline record types with `StringMap`
- [ ] Mark `State` fields `readonly`; fix any compile fallout

### Related

- [node-module-layering](../../todo/node-module-layering.md) — flags the
  `NodeProgramOptions.std` deviation only; these are the remaining ones
