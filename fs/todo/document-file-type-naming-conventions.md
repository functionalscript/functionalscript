## Document file-type naming conventions

**Priority:** P3
**Status:** open

The repo uses several filename conventions to signal what a file *is* — pure module, proof, application entry point — but the conventions are only implied by usage. There is no single place that defines them.

Document the file-type conventions in `fs/README.md` (or a dedicated `CONVENTIONS.md`):

### `module.*` — a module

- `module.f.ts` / `module.f.js` — FunctionalScript module: pure by construction, safe to bulk-load.
- `module.ts` / `module.js` — vanilla TS/JS: host integration that may run side effects at import time.

### `proof.*` — a module that proves other modules

Tests other modules. Usually exports only `proof` (the proof tree). See [`fs/emergent_testing/README.md`](emergent_testing/README.md).

- `proof.f.ts` / `proof.f.js` — FunctionalScript proof.
- `proof.ts` / `proof.js` / `proof.mts` / `proof.mjs` — vanilla proof.

### `node.app.f.ts` / `node.app.f.js` — a Node application

A module whose `export default` is a `NodeProgram` (`Program<NodeOp>`). The `.f.` infix is kept because the program is a pure effect description:

```ts
import app from './node.app.f.ts'
import { run } from '../effects/node/module.ts'
await run(app)
```

### Open questions

- Should existing entry points (`fs/fjs/module.ts`) be migrated to the `node.app.f.ts` convention, or only new entry points?
- Canonical doc location: top-level `README.md`, `fs/README.md`, or `CONVENTIONS.md`?
