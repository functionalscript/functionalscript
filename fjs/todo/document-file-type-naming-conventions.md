## Document file-type naming conventions

**Priority:** P3
**Status:** open

The repo uses several filename conventions to signal what a file *is* — pure module, proof, application entry point — but the conventions are only implied by usage. There is no single place that defines them.

Document the file-type conventions in `fjs/README.md` (or a dedicated `CONVENTIONS.md`):

### `module.*` — a module

- `module.f.mjs` / `module.f.js` — FunctionalScript module: pure by construction, safe to bulk-load.
- `module.mjs` / `module.ts` — vanilla JS/TS: host integration that may run side effects at import time.

### `proof.*` — a module that proves other modules

Tests other modules. Usually exports only `proof` (the proof tree). See [`fjs/emergent_testing/README.md`](../emergent_testing/README.md).

- `proof.f.mjs` / `proof.f.js` — FunctionalScript proof.
- `proof.ts` / `proof.js` / `proof.mts` / `proof.mjs` — vanilla proof.

### `node.app.f.mjs` / `node.app.f.js` — a Node application

A module whose `export default` is a `NodeProgram` (`Program<NodeOp>`). The `.f.` infix is kept because the program is a pure effect description:

```js
import app from './node.app.f.mjs'
import { run } from '../effects/node/module.mjs'
await run(app)
```

### Open questions

- Should existing entry points (`fjs/module.mjs`) be migrated to the `node.app.f.mjs` convention, or only new entry points?
- Canonical doc location: top-level `README.md`, `fjs/README.md`, or `CONVENTIONS.md`?
