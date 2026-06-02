# 65Y-io-type-duplication. Eliminate `fs/io` / `fs/types/effects/node` type duplication

**Priority:** P3
**Status:** open

## Problem

`fs/io/module.f.ts` is `@deprecated` (its JSDoc points at
[i139](./README.md) for the replacement) but it still defines a parallel
set of types whose names collide one-for-one with the canonical effect
shapes in `fs/types/effects/node/module.f.ts`. Today the two modules
co-exist and each carries its own copy of the same name:

| Type / value | `fs/io/module.f.ts` | `fs/types/effects/node/module.f.ts` |
|---|---|---|
| `Dirent`              | 36–41  | 72–76  |
| `MakeDirectoryOptions`| 48–50  | 52     |
| `IncomingMessage`     | 120–124| 135–140|
| `ServerResponse`      | 126–129| 142–146|
| `RequestListener`     | 131    | 148    |
| `Server`              | 114–116| 126–127 (`Nominal` opaque) |

The names are identical but the shapes are not: the `fs/io` copies
describe **Node.js-shaped callbacks** (`isFile: () => boolean`,
`writeHead(...).end(...)`, `Promise`-returning request listeners), while
the `fs/types/effects/node` copies describe the **effect-shaped wire
types** the runner sees (`isFile: boolean`, structural `ServerResponse`,
`Effect`-returning request listener over `Operation`s). The `fs/io`
adapter (`fromIo`, lines 208–279) converts between them — that
conversion is the whole job of the deprecated module — so the duplicate
shapes are an artifact of the migration boundary, not two
independently-evolved data types.

The remaining live consumers of `fs/io` are four files:

```
fs/fjs/module.ts            : default-imports `effectRun` (the Node bootstrap)
fs/emergent-testing/module.ts         : `io`, `runProgram` — same Node bootstrap
fs/dev/module.f.ts          : `Io` — used by the `env` helper (live: tested in fs/dev/proof.f.ts:59 since PR #886)
fs/djs/parser/module.f.ts   : `Fs` — only used by the unreferenced `ParseContext` export (see i65Y-dead-code-cleanup)
```

Of these, only the `djs/parser` edge is dead (it goes away with
[i65Y-dead-code-cleanup](./65Y-dead-code-cleanup.md) item 1). The
`env`-helper edge in `fs/dev/module.f.ts` and the two `module.ts`
bootstraps need real migration. Once Step 1 (below) is done, the
`env` helper can type itself against the canonical effect-shaped
inputs instead of `Io`, dropping the third live edge with no loss
of coverage.

## Proposal

Close out the migration in two steps; each is independently shippable.

### Step 1 — collapse the duplicated type names

Move the Node-shaped adapter types out of the public surface of
`fs/io/module.f.ts` and rename them so the two modules can no longer
mint two different `Dirent` / `IncomingMessage` / `ServerResponse` etc.
for callers to confuse:

```ts
// fs/io/module.f.ts (deprecated, internal-only)
// rename to make the role explicit and stop colliding with effects/node:
type NodeFsDirent       = { name: string; parentPath: string; isFile: () => boolean; isDirectory: () => boolean }
type NodeMkdirOptions   = { recursive?: boolean }
type NodeIncomingMessage= Readable & { method: string; url: string; headers: Headers }
type NodeServerResponse = { writeHead: ...; end: ... }
type NodeRequestListener= (req: NodeIncomingMessage, res: NodeServerResponse) => Promise<void>
```

These are pure structural descriptions of the Node-side callbacks the
adapter consumes. They never need to be `export`ed because the only
public function in the module that touches them is `fromIo`/`runProgram`,
which the bootstrap files use through the canonical effect-shaped
types from `fs/types/effects/node`.

After this step, every `Dirent`/`IncomingMessage`/`ServerResponse` /
`RequestListener` reference in the codebase points at the
effect-shaped definition in `fs/types/effects/node/module.f.ts`. No
behaviour change; the adapter still translates at the boundary.

### Step 2 — fold the two bootstraps into one module under `effects/node`

The remaining real consumers are two near-identical Node bootstraps:

```ts
// fs/fjs/module.ts
import { main } from './module.f.ts'
import effectRun from '../io/module.ts'
effectRun(main)

// fs/emergent-testing/module.ts
import { io } from '../../io/module.ts'
import { register } from './module.f.ts'
import { runProgram } from '../../io/module.f.ts'
export const run = () => runProgram(io)([])(register)
```

Both reach into `fs/io/module.ts` only to grab the live `Io` instance
and the `effectRun` / `runProgram` driver. Move that wiring next to
the canonical effect types — e.g. `fs/types/effects/node/runtime.ts`
(or `runner.ts`) — and replace the two bootstraps with one-line imports
from there. Once both call sites stop importing from `fs/io`, the
deprecated module has no live consumers and can be deleted in a
follow-up.

## Why this qualifies

- **Separation of concerns.** Two modules currently own a type named
  `Dirent` (and `IncomingMessage`, and `ServerResponse`, …) with
  different shapes. Pick a side; the one named for the contract
  (`effects/node` — the effect runner's wire types) wins, and the
  Node-callback shapes become unexported adapter internals.
- **DRY at the right altitude.** The five colliding pairs were always
  the same concept under two names. Removing the duplication also
  removes the cognitive cost of asking "which `Dirent` is this?" for
  every reader who lands on a path containing the word `io`.
- **Removes a deprecation footgun.** As long as `fs/io` exports
  `Dirent` / `IncomingMessage` / `ServerResponse` etc., new code can
  accidentally import them and re-anchor the deprecated module. Renaming
  to `NodeFsDirent` / `NodeIncomingMessage` (or just dropping the export)
  makes accidental re-anchoring impossible — the only entry point
  surviving past Step 1 is `effectRun` / `runProgram` themselves.
- **Concrete prerequisite for `fs/io` removal.** Step 2, plus
  retyping the `env` helper against effect-shaped inputs, reduces the
  live consumers of `fs/io` from four files to zero (after
  [i65Y-dead-code-cleanup](./65Y-dead-code-cleanup.md) ships item 1).
  Deletion then becomes a one-PR follow-up.

## Caveats / why this is an idea, not a mechanical edit

- **`Server` is genuinely two different things.** `fs/io`'s `Server`
  is the concrete Node `http.Server`-shaped object the adapter calls
  `.listen()` on; `fs/types/effects/node`'s `Server` is a
  `Nominal<'server', …>` opaque handle exposed to programs. They
  cannot collapse. Both should keep their names but, after Step 1,
  the Node-side one should live as an unexported adapter type with a
  distinguishing name (`NodeHttpServer`).
- **Step 2 touches the engine-detection logic.** `fs/io/module.ts:14`
  uses a top-level `await import('@playwright/test')` to detect
  Playwright at module load. Moving the bootstrap is a good moment to
  decide whether engine detection belongs in the runtime module or
  whether it should be a `NodeProgramOptions` field set by the caller
  — but that's an orthogonal decision the move surfaces.
- **`AGENTS.md` rule applies.** "Don't implement a feature, helper, or
  module that no existing module uses." After Steps 1+2, anything
  remaining in `fs/io` that is still unused (e.g. the
  `Performance`/`Console`/`Process` shapes) should be deleted in the
  same PR, not re-homed "just in case."
- **CHANGELOG note required.** Renaming exports is a public API
  change even on a deprecated module. Land Step 1 with a CHANGELOG
  entry calling out the rename so any downstream consumers can adjust.

## Related

- [i65Y-dead-code-cleanup](./65Y-dead-code-cleanup.md) — removes the
  dead `ParseContext` in djs/parser, which is one of the four live
  `fs/io` consumers. (The companion proposal to also delete `env` was
  withdrawn after PR #886 added test coverage for it.)
- [i208](./208-try-catch-consolidate.md) — collapses the `tryCatch`
  duplication between `fs/io/module.ts:71` and `fs/io/module.f.ts:189`
  while `fs/io` is still alive; complementary cleanup along the same
  deprecation arc.
- [i198](./198-utf8-file-effects.md),
  [i176](./176-json-file-effects.md) — lift the UTF-8/JSON file
  sandwiches into `fs/types/effects/node`. After those land, the
  `effects/node` module is the unambiguous home for all file I/O,
  reinforcing the choice of side made here.

- `fs/io/module.f.ts:36,48,120,126,131` — duplicated type definitions.
- `fs/types/effects/node/module.f.ts:72,52,135,142,148` — canonical
  effect-shaped definitions.
- `fs/fjs/module.ts`, `fs/emergent-testing/module.ts` — the two live bootstraps
  that still need a home.
