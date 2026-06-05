# 663-file-type-conventions. Document the file-type naming conventions

**Priority:** P3
**Status:** open

## Problem

The repo uses several filename conventions to signal what a file *is* — pure
module, proof, application entry point — but the conventions are only implied by
usage and scattered discovery rules (`shouldLoad`, the two-tier load gate). There
is no single place that defines them. New contributors (and adopters of the
convention outside this repo) have to reverse-engineer the meaning of
`module.f.ts` vs `module.ts` vs `proof.f.ts`.

## Proposal

Document the file-type conventions in one place (e.g. a top-level `README.md`
section or `fs/README.md`). The `.f.` infix continues to mean *FunctionalScript*
(pure, no import side effects); its absence means vanilla TS/JS (host
integration, side effects allowed).

### `module.*` — a module

A set of utilities and types, usually **without** side effects.

- `module.f.ts` / `module.f.js` — a FunctionalScript module: pure by
  construction, safe to bulk-load.
- `module.ts` / `module.js` — a vanilla TS/JS module: host integration that may
  run side effects at import time (e.g. the Node effect runner in
  `fs/effects/node/module.ts`).

### `proof.*` — a module that proves other modules

A module that tests other modules. Usually it has only one export, `proof` (the
proof tree). See [`fs/emergent_testing/README.md`](../fs/emergent_testing/README.md)
for the proof shape and discovery rules.

- `proof.f.ts` / `proof.f.js` — a FunctionalScript proof.
- `proof.ts` / `proof.js` / `proof.mts` / `proof.mjs` — a vanilla proof
  (opt-in by filename, since vanilla modules can have import side effects).

### `node.app.f.ts` / `node.app.f.js` — a Node application

A module whose `export default` is a `NodeProgram`
(`Program<NodeOp>`, defined in `fs/effects/node/module.f.ts`). This names the
entry-point role explicitly instead of leaving it as an untyped `module.ts`
convention.

A launcher then runs the default export, e.g.:

```ts
import app from './node.app.f.ts'
import { run } from '../effects/node/module.ts'
await run(app)
```

Because the program is a pure `NodeProgram` value (an effect description, not an
executed effect), the file keeps the `.f.` infix.

## Open questions

- Should existing entry points (`fs/fjs/module.ts`, the `bin` shell in
  `fs/fjs`) be migrated to the `node.app.f.ts` convention, or does the
  convention apply to new entry points only?
- Where should the canonical doc live — top-level `README.md`, `fs/README.md`,
  or a dedicated `CONVENTIONS.md`?

## Related

- i65Y-proof-by-export — proof discovery by exported `proof` property
- [`fs/emergent_testing/README.md`](../fs/emergent_testing/README.md) — proof / proof-module definitions
