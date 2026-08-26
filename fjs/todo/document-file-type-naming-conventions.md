## Document file-type naming conventions

**Priority:** P3
**Status:** open

The repo uses several filename conventions to signal what a file *is* — pure
module, proof, application entry point — but their documentation is split.
[`fjs/AGENTS.md` §3.5](../AGENTS.md#35-functionalscript-module-rules) owns the
FunctionalScript source and type-only import rules, while `fjs/README.md` owns
the CLI and `main`-export conventions. Neither gives a reader a short map of
the file types or points to the other.

Document the file-type conventions in `fjs/README.md`, next to the existing CLI
and `main`-export conventions:

### `module.*` — a module

- `module.f.mjs` — authored FunctionalScript module: pure by construction and
  safe to bulk-load. `.f.js` is the planned spelling for parser-compatible,
  dependency-closed groups once authored-`.f.js` package support exists, not a
  spelling authors use today.
- `module.mjs` — vanilla JavaScript host integration. It may use capabilities
  outside FunctionalScript and may run effects at import time.
- `types.ts` — authored, type-only TypeScript companion. It has no runtime
  representation and is imported only with `import type` or JSDoc `@import`.

### `proof.*` — a module that proves other modules

Tests other modules. Usually exports only `proof` (the proof tree). See [`fjs/emergent_testing/README.md`](../emergent_testing/README.md).

- `proof.f.mjs` — authored FunctionalScript proof. Like implementation modules,
  proofs move to `.f.js` only in parser-compatible, dependency-closed groups
  once authored-`.f.js` package support exists.
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

### Tasks

- [ ] Add the conventions as a dedicated section in `fjs/README.md`; link to
      the source rules in `fjs/AGENTS.md` and the existing compiler, testing,
      and `fjs run` documentation instead of duplicating their details.
- [ ] Check every spelling against the files currently authored under `fjs/`.
- [ ] Remove this issue in the same pull request as the documentation.
