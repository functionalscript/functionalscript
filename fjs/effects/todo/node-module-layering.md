## node-module-layering. Lower the runtime-agnostic operations out of `fjs/effects/node`

**Priority:** P3
**Status:** open

### Problem

`fjs/effects/node/module.f.ts` is 544 lines declaring ~25 operation families.
Most are genuinely Node-shaped I/O — `Fs` (`mkdir`, `readFile`, `readdir`,
`writeFile`, `rm`, `rename`, `readBytes`, `writeBytes`, `stat`, `access`,
`createExclusive`, `exec`), `Http` (`createServer`, `listen`), `Fetch`,
`Import`, `Forever`. But several are not about Node, or about I/O, at all:

| Export | What it actually is |
|---|---|
| `IoResult<T>` (`:23`), `isNotFound` (`:33`) | `Result<T, unknown>` plus an `ENOENT` predicate — a types-layer alias |
| `All` / `all` / `both` (`:38-54`) | concurrency; runner infrastructure, no host API |
| `Await` / `awaitIfPromise` (`:437-444`) | host promise interop — every JS runtime |
| `Sandbox` / `SandboxResult` / `sandbox` (`:399-428`) | measured, exception-trapping invocation of a plain function |
| `Now` (`:385`), `RandomInt` (`:152`) | ambient values, not filesystem |
| `Test` / `TestFn` / `TestContext` (`:446-473`) | registration with an external test framework; `fjs/emergent_testing` is the only consumer |
| `Write` / `Read` / `log` / `error` / `readLine` (`:301-381`) | console streams |

Because they all live behind one Node-flavoured import path, modules that need
none of Node's I/O still import from it, and the effects package cannot layer
itself cleanly. Four concrete symptoms, three of them already written down in
other issues:

1. **`fjs/media/type/module.f.ts:40`** — a pure media-type detector imports
   `type IoResult` from `../../effects/node/module.f.ts`. The whole reason is a
   type alias that expands to `Result<T, unknown>` from `fjs/types/result`.

2. **[fold-stream-combinator](./fold-stream-combinator.md)** cannot put
   `IoResult` in the signature of a combinator that belongs in
   `fjs/effects/list`, because `effects/node` already imports `effects/list` —
   *"importing it back would be a cycle"*. The issue works around it by
   re-spelling the type as `Result<Vec, unknown>` at the definition site while
   callers keep passing `IoResult` values.

3. **[allvoid-combinator](./allvoid-combinator.md)** must place `allVoid` in the
   node module instead of next to its sequential sibling `forEachStep` in the
   effects core, *"It cannot live next to `forEachStep` … placing `allVoid` in
   core would invert that dependency"* — and explicitly flags the fix as out of
   its scope: *"If `All` is ever lowered out of the node module (it is runner
   infrastructure, not node-specific I/O — a separate design question)"*. This
   issue is that design question.

4. **`fjs/text/sgr/module.f.ts:11`** — an ANSI SGR module imports `write`,
   `Write`, `WriteConsoles` and `NodeProgramOptions` from the Node module;
   `fjs/emergent_testing/module.f.ts:14-30` imports 15 names from it, of which
   only `Env`/`NodeProgram`/`NodeProgramOptions` are Node-specific.

The module's own header already reads as a list of unrelated concerns:
*"filesystem …, networking …, subprocess `exec`, `log`/`error` …, `import_`,
`now`, `sandbox`, `forever`, and `all`/`both` parallelism"*. That is the
separation-of-concerns smell stated in the documentation.

### Proposal

Move each non-Node concern to the layer that owns it, leaving
`fjs/effects/node/module.f.ts` to be exactly *the operations a Node-like host
provides*. Proposed destinations:

| Moves to | Contents |
|---|---|
| `fjs/effects/module.f.ts` (core) | `IoResult<T>` — core already imports `Result` from `fjs/types/result`, so this costs no new dependency and unblocks symptom 2 |
| `fjs/effects/all/module.f.ts` | `All`, `all`, `both`, and `allVoid`/`allReduce` when they land |
| `fjs/effects/sandbox/module.f.ts` | `Sandbox`, `SandboxResult`, `sandbox`, `Await`, `awaitIfPromise` — the "run foreign code and observe what happened" pair |
| `fjs/effects/console/module.f.ts` | `Read`, `Write`, `ReadConsoles`, `WriteConsoles`, `Console`, `log`, `error`, `readLine`, `errorExit` |
| `fjs/emergent_testing/` | `Test`, `TestFn`, `TestContext` — its only consumer, and the module that defines what a test *is* |
| stays in `fjs/effects/node` | `Fs` and its members, `Http`, `Fetch`, `Import`, `Forever`, `Now`, `RandomInt`, `isNotFound`, `Env`, `Engine`, `NodeOp`, `NodeProgramOptions`, `Program`, `NodeProgram`, `NodeOperationMap` |

`NodeOp` stays where it is and keeps unioning every family — it is the
*runner's* op-set, which is legitimately "everything this host can do", and both
interpreters (`fjs/effects/node/module.ts`, `fjs/effects/node/virtual`) keep a
single place to enumerate. Only the *declaration* of each family moves; the
union that names them all does not.

Judgement calls worth deciding explicitly rather than by accident:

- **`Now` / `RandomInt` stay.** They are ambient host capabilities with no
  cross-runtime abstraction to gain, and no consumer outside `fjs/cas` and the
  interpreters. Moving them would be motion without a reader benefit.
- **`isNotFound` stays.** It encodes Node's `ENOENT` shape specifically; that
  *is* a Node concern, even though `IoResult` is not.
- **Don't invent a module per operation.** Group by concern; a directory with
  one four-line module per effect is worse than the monolith.

### Why this qualifies

- **Separation of concerns**, the form `AGENTS.md` calls *always* appropriate:
  "move logic to its natural module even with a single consumer when the logic
  is conceptually distinct". Concurrency, sandboxing, console streams, and test
  registration are four distinct concepts currently sharing one file because
  they happen to be implemented by the same runner.
- **It unblocks work already blocked.** Symptoms 2 and 3 are two open issues
  that each pay a design tax to route around this layering; a third
  (`fjs/media/type`) pays it silently.
- **It shrinks the widest import surface in the repo.** 22 modules import from
  `effects/node`; most of them want a slice of it.

### Caveats

- **Every move is a breaking change** to an import path. Per `AGENTS.md`, do one
  concern per PR, update every importer in the same PR, and prefix the CHANGELOG
  entry with `**BREAKING CHANGES:**`. Do not leave re-export shims behind.
- **Verify no new cycles** before each move. In particular `fjs/effects/console`
  needs `Vec` (`fjs/types/bit_vec`) and the `fjs/text` encoders — check that
  none of those import back into `fjs/effects`.
- **Land [allvoid-combinator](./allvoid-combinator.md) after the `All` move**,
  not before, so `allVoid` is written once in its final home.
- **`Test`'s payload references `All` and `Await`** (`:471-472`), so the test
  move should follow the `all` and `sandbox` moves.

### Tasks

- [ ] Move `IoResult<T>` to `fjs/effects/module.f.ts`; update
      `fjs/media/type`, `fjs/cas`, `fjs/effects/node/virtual` and re-check
      [fold-stream-combinator](./fold-stream-combinator.md)'s workaround.
- [ ] Move `All` / `all` / `both` to `fjs/effects/all/module.f.ts`.
- [ ] Move `Sandbox` / `Await` and helpers to `fjs/effects/sandbox/module.f.ts`.
- [ ] Move the console family to `fjs/effects/console/module.f.ts`.
- [ ] Move `Test` / `TestFn` / `TestContext` into `fjs/emergent_testing/`.
- [ ] Register each new `module.f.ts` in `deno.json`'s `exports` map; update the
      `fjs/effects/node` module header to describe only what remains.
- [ ] `npx tsc` and `fjs t` after each move; one PR per concern.

### Related

- [allvoid-combinator](./allvoid-combinator.md) — names the `All` lowering as a
  separate design question; this is it.
- [fold-stream-combinator](./fold-stream-combinator.md) — its `Result`-instead-of-`IoResult`
  workaround disappears once `IoResult` lives in core.
- `fjs/media/type/module.f.ts:40`, `fjs/text/sgr/module.f.ts:11`,
  `fjs/emergent_testing/module.f.ts:14-30` — importers that reach into the Node
  module for non-Node things.
- [group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — the same regroup-by-concern exercise one level up, at `fjs/`.
