## Document file-type naming conventions

**Priority:** P3
**Status:** open

The repo uses several filename conventions to signal what a file *is* — pure module, proof, application entry point — but the conventions are only implied by usage. There is no single place that defines them.

Document the file-type conventions in `fjs/README.md`, next to the existing CLI
and `main`-export conventions:

### `module.*` — a module

- `module.f.mjs` — authored FunctionalScript module: pure by construction and
  safe to bulk-load. `.f.js` is the planned spelling after the compiler's
  extension migration, not a spelling authors use today.
- `module.mjs` — vanilla JavaScript host integration. It may use capabilities
  outside FunctionalScript and may run effects at import time.
- `types.ts` — authored, type-only TypeScript companion. It has no runtime
  representation and is imported only with `import type` or JSDoc `@import`.

### `proof.*` — a module that proves other modules

Tests other modules. Usually exports only `proof` (the proof tree). See [`fjs/emergent_testing/README.md`](../emergent_testing/README.md).

- `proof.f.mjs` — authored FunctionalScript proof. `.f.js` is the planned
  spelling after the compiler's extension migration.
- `proof.mjs` — vanilla JavaScript proof, used when the proof needs host
  capabilities that FunctionalScript excludes.

### Applications use `main`; they do not get a filename suffix

A FunctionalScript application is an ordinary module whose named `main` export
is a `NodeProgram` (`Program<NodeOp>`). Its effect description remains pure, so
the ordinary `.f.mjs` marker already says everything a `node.app.f.mjs` suffix
would say. The named export also matches the existing `fjs run` contract; do
not introduce a competing default-export convention.

```js
import { main } from './module.f.mjs'
import { run } from '../effects/node/module.mjs'
await run(main)
```

The host-side `module.mjs` runner is separate when an application needs one.
Existing and new applications both follow this convention; no entry-point
rename is required.

### Proof

- Add the conventions as a dedicated section in `fjs/README.md` and link to
  the existing compiler, testing, and `fjs run` documentation instead of
  duplicating their details.
- Check every spelling against the files currently authored under `fjs/`.
- Remove this issue in the same pull request as the documentation.
