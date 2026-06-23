# TODO

## Group `fs/` subdirectories by concern

**Priority:** P4
**Status:** open

`fs/` has 28 top-level directories mixing foundational data structures (`types`), byte/character encoders (`base64`, `base128`, `cbase32`), language tooling (`json`, `djs`, `fjs`, `fsc`, `bnf`, `js`, `html`), crypto, storage (`cas`, `sul`), and project infrastructure (`ci`, `dev`, `website`). Regroup incrementally — not a big-bang reorg, since every cross-module import is a relative `.f.ts` path.

### 1. `fs/basen/` — group base-N encoders

Move `base64`, `base128`, `cbase32` under `fs/basen/`. They are sibling alphabet-parameterised encoders sharing a codec factory.

### 2. `fs/common/` — common algorithms

Create `fs/common/` for cross-cutting reusable algorithms, starting by moving `monoid` (currently `fs/types/monoid`) there. Admit only genuinely cross-cutting *algorithms* — not data structures or type-level utilities.

### 3. Promote `fjs` bin to `fs/` root

`fs/fjs/module.f.ts` is the top-level CLI dispatcher — nothing imports it as a library. Move `fs/fjs/{module.ts, module.f.ts, proof.f.ts, README.md}` to `fs/`. Update `package.json` (`bin.fjs`, scripts) and `deno.json` (`fjs` task). Fix relative imports (drop one `../`).

### Later candidates

- `lang/` for language/format tooling (`json`, `djs`, `fjs`, `fsc`, `bnf`, `js`, `html`) — highest value but highest churn.
- Storage bucket for `cas` + `sul`; testing bucket for `asserts` + `emergent_testing`.

### Tasks

- [ ] Create `fs/basen/` and move `base64`, `base128`, `cbase32` into it.
- [ ] Create `fs/common/` and move `monoid` from `fs/types/` into it.
- [ ] Promote the `fjs` bin to `fs/` root; update `package.json`/`deno.json` script paths and fix relative imports.
- [ ] Update all relative imports referencing the moved modules.
- [ ] Update `deno.json` `exports` map and run `npm run update`.
- [ ] Verify `npx tsc` and `fjs t` pass.

---

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

---

## Formatter for `.f.js` and `.f.ts` files

**Priority:** P3
**Status:** open

Find or build a formatter that handles `.f.js` and `.f.ts` files correctly.

---

## Investigate eslint-config-jessie

**Priority:** P3
**Status:** open

See [eslint-config-jessie](https://github.com/Agoric/eslint-config-jessie).

---

## Detect unexported types referenced by exported types

**Priority:** P5
**Status:** open

TypeScript doesn't show an error if an exported type references a non-exported type:

```ts
type A = number
export type B = A | string
```

We need to find a way to detect such cases. Notes:

- FunctionalScript doesn't have RegEx, so an ad-hoc text-scan in `.f.ts` is not possible.
- Requires emitting `.d.ts` via `tsc` and inspecting the output (or driving the TypeScript Compiler API) — an external tool, not a FunctionalScript module.
- The proper place for this check is a FunctionalScript parser, which is not available yet.

---
