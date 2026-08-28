## node-module-layering. Lower the runtime-agnostic operations out of `fjs/effects/node`

**Priority:** P3
**Status:** open

### Problem

`fjs/effects/node/module.f.mjs` (plus its `types.ts` companion) declares ~25 operation families.
Most are genuinely Node-shaped I/O — `Fs` (`mkdir`, `readFile`, `readdir`,
`writeFile`, `rm`, `rename`, `readBytes`, `writeBytes`, `stat`, `access`,
`createExclusive`, `exec`), `Http` (`createServer`, `listen`), `Fetch`,
`Import`, `Forever`. But several are not about Node, or about I/O, at all:

| Export | What it actually is |
|---|---|
| `All` / `all` / `allOk` / `both` (`types.ts:84`, `module.f.mjs:118`, `:163`, `:173`) | concurrency; runner infrastructure, no host API |
| `Await` / `awaitIfPromise` (`types.ts:237`, `module.f.mjs:295-299`) | host promise interop — every JS runtime |
| `Sandbox` / `SandboxResult` / `sandbox` (`types.ts:219-228`, `module.f.mjs:292`) | measured, exception-trapping invocation of a plain function |
| `Now` (`types.ts:207`), `RandomInt` (`types.ts:78`) | ambient values, not filesystem |
| `Test` / `TestFn` / `TestContext` (`types.ts:245-283`, `module.f.mjs:304`) | registration with an external test framework; `fjs/emergent_testing` is the only consumer |
| `Write` / `Read` / `log` / `error` / `readLine` (`types.ts:183-200`, `module.f.mjs:206-268`) | console streams |

Because they all live behind one Node-flavoured import path, modules that need
none of Node's I/O still import from it, and the effects package cannot layer
itself cleanly. Two concrete symptoms:

1. **[allvoid-combinator](./allvoid-combinator.md)** must place `allVoid` in the
   node module instead of next to its sequential sibling `forEachStep` in the
   effects core, *"It cannot live next to `forEachStep` … placing `allVoid` in
   core would invert that dependency"* — and explicitly flags the fix as out of
   its scope: *"If `All` is ever lowered out of the node module (it is runner
   infrastructure, not node-specific I/O — a separate design question)"*. This
   issue is that design question.

2. **`fjs/text/sgr/module.f.mjs:13`** — an ANSI SGR module imports `write`,
   `Write`, `WriteConsoles` and `NodeProgramOptions` from the Node module;
   `fjs/emergent_testing/module.f.mjs:16-29` imports names from it, of which
   only `Env`/`NodeProgram`/`NodeProgramOptions` are Node-specific.

The module's own header already reads as a list of unrelated concerns:
*"filesystem …, networking …, subprocess `exec`, `log`/`error` …, `import_`,
`now`, `sandbox`, `forever`, and `all`/`both` parallelism"*. That is the
separation-of-concerns smell stated in the documentation.

### Proposal

Move each non-Node concern to the layer that owns it, leaving
`fjs/effects/node/module.f.mjs` to be exactly *the operations a Node-like host
provides*. Proposed destinations:

| Moves to | Contents |
|---|---|
| `fjs/effects/all/module.f.mjs` | `All`, `all`, `allOk`, `both`, and `allVoid`/`allReduce` when they land |
| `fjs/effects/sandbox/module.f.mjs` | `Sandbox`, `SandboxResult`, `sandbox`, `Await`, `awaitIfPromise` — the "run foreign code and observe what happened" pair |
| `fjs/effects/console/module.f.mjs` | `Read`, `Write`, `ReadConsoles`, `WriteConsoles`, `Console`, `log`, `error`, `readLine`, `errorExit`, and a **new named `Std`** (see below) |
| `fjs/effects/test/module.f.mjs` | `Test`, `TestFn`, `TestContext`, `test` — registration with an external framework, not I/O |
| stays in `fjs/effects/node` | `Fs` and its members, `Http`, `Fetch`, `Import`, `Forever`, `Now`, `RandomInt`, `isNotFound`, `Env`, `Engine`, `NodeOp`, `NodeProgramOptions`, `Program`, `NodeProgram`, `NodeOperationMap` |
| already moved to `fjs/effects` | `OpResult`, `IoChannel`, `IoError`, `IoErrorInfo`, `IoResult`, `ioError`, `toIoError` — the vocabulary every operation is declared in; `effects/node` re-exports them (see the judgement call below) |

`NodeOp` stays where it is and keeps unioning every family — it is the
*runner's* op-set, which is legitimately "everything this host can do", and both
interpreters (`fjs/effects/node/module.mjs`, `fjs/effects/node/virtual`) keep a
single place to enumerate. Only the *declaration* of each family moves; the
union that names them all does not.

Judgement calls worth deciding explicitly rather than by accident:

- **`Now` / `RandomInt` stay.** They are ambient host capabilities with no
  cross-runtime abstraction to gain, and no consumer outside `fjs/cas` and the
  interpreters. Moving them would be motion without a reader benefit.
- **`isNotFound` stays, and this was tested.** It encodes `ENOENT`
  specifically — a POSIX filesystem code that a host without a filesystem never
  reports — so it *is* a Node-layer concern. A change that moved it to the core
  along with the error vocabulary was reviewed against this line and reverted
  on it: being about a *host failure* does not make a thing host-agnostic,
  being about no host in particular does.
- **`IoResult<T>` moved to the effects core, and this issue was wrong to say it
  should not.** The reasoning here was that `Result<T, unknown>` is not an
  effect constructor or combinator, so the core is the wrong home and pure
  consumers should spell the underlying type instead. What that reasoning did
  not have was a **second host**. `IoResult` is not "exactly a Node-layer
  contract": it is the shape every host's IO operations answer in, and a
  browser interpreter cannot declare `fetch` or `import` without it. The same
  goes for `OpResult`, `IoChannel`, `IoError` and `IoErrorInfo`, which this
  issue never listed — `OpResult` is `Result<T, NotImplemented>`, defined
  purely in terms of a type the core already owns, and `effects/memory` (no
  host at all) was importing it from `effects/node`.

  The "not an effect constructor or combinator" test also did not describe the
  file it was applied to: `NotImplemented` already lives in the core and is
  neither. What the core holds is the vocabulary an operation is *declared*
  in, and this is that.

  The one-site cleanup this bullet also proposed is still worth doing and is
  now the task below: `fjs/media/type/module.f.mjs` imports `IoResult` only to
  spell two signatures, and `Result<Vec, unknown>` from `fjs/types/result` says
  the same thing without reaching into the effects package at all.
  [fold-stream-combinator](./fold-stream-combinator.md) reached that conclusion
  independently for `fjs/effects/list`. That a pure consumer should not name an
  IO alias and that a *second host* needs one to exist somewhere shared are
  both true; the old bullet collapsed them into one answer.
- **`Test` goes to an effects module, not to `fjs/emergent_testing`.**
  `emergent_testing` looks like the natural owner — it is the only consumer of
  `test` and the module that defines what a test *is* — but putting the
  declarations there is a cycle, not a layering. Two contracts `effects/node`
  keeps refer to them: `NodeOp` unions `Test`
  (`fjs/effects/node/types.ts:282`) and `NodeProgramOptions` carries the
  `TestContext` fields used by the surviving process-side test adapters. Those
  are runner configuration and stay in `effects/node` — so `effects/node` would
  have to import `emergent_testing`, while `emergent_testing/module.f.mjs:21-24`
  keeps importing `NodeProgram`, `NodeProgramOptions` and `Program` back from
  `effects/node`. `fjs/effects/test/module.f.mjs` sits below both, so both may
  import it and the dependency stays a DAG. (The alternative — moving
  `NodeProgramOptions`' surviving test contexts up as well — would drag the
  whole program contract along and is not worth it.)

  The Playwright context is not part of that surviving contract: it has already
  been removed, and this layering task operates on that post-cleanup shape. Do
  not reintroduce a Playwright field in `NodeProgramOptions`; the future
  Playwright adapter belongs to the browser-testing controller and consumes the
  shared browser report rather than the Node `Test` effect.
- **The console move must also narrow `csiWrite`, or symptom 2 survives it.**
  Moving `write`/`Write`/`WriteConsoles` alone does **not** free
  `fjs/text/sgr/module.f.mjs` from `effects/node`, because `csiWrite` (`:96-99`)
  takes the whole `NodeProgramOptions` record and destructures a single field
  out of it:

  ```ts
  export const csiWrite =
      ({ std }: NodeProgramOptions) =>
      (stream: WriteConsoles): (s: string) => Effect<Write, void> => { … }
  ```

  So sgr would keep importing `NodeProgramOptions` and the coupling this issue
  cites would be exactly preserved. Name the minimal contract in the console
  module and have `csiWrite` take *that*:

  ```ts
  // fjs/effects/console/module.f.mjs
  import type { RequiredMap } from '../../types/object/types.ts'

  export type Std = RequiredMap<WriteConsoles, { readonly isTTY: boolean }>

  // fjs/text/sgr/module.f.mjs
  export const csiWrite = (std: Std) => (stream: WriteConsoles) => …
  ```

  Note the `RequiredMap` spelling: `AGENTS.md` requires the `fjs/types/object`
  record types for *all* string-keyed record types, and over a finite key union
  `RequiredMap<WriteConsoles, T>` is the same required-field record the inline
  mapped type produces.
  `NodeProgramOptions.std` (`fjs/effects/node/types.ts:316`) writes that
  inline form by hand today — a pre-existing deviation from the rule, in a
  module that already imports the open-key-set `StringMap` at `:12` and uses it
  for `Headers` and `Module`. Pointing `std` at the named `Std` fixes that deviation as a side
  effect and keeps the runner contract in sync with the console module by
  construction.

  `csiWrite` has one caller — `fjs/emergent_testing/module.f.mjs:360`,
  `csiWrite(options)` — which becomes `csiWrite(options.std)`. This is the
  AGENTS.md "fix the design rather than bend the caller" direction: `csiWrite`
  never wanted a whole program-options record.
- **Don't invent a module per operation.** Group by concern; a directory with
  one four-line module per effect is worse than the monolith.

### Why this qualifies

- **Separation of concerns**, the form `AGENTS.md` calls *always* appropriate:
  "move logic to its natural module even with a single consumer when the logic
  is conceptually distinct". Concurrency, sandboxing, console streams, and test
  registration are four distinct concepts currently sharing one file because
  they happen to be implemented by the same runner.
- **It unblocks work already blocked.** [allvoid-combinator](./allvoid-combinator.md)
  is an open issue that pays a design tax to route around this layering, and
  says so in its own text.
- **It shrinks the widest import surface in the repo.** 22 modules import from
  `effects/node`; most of them want a slice of it.

### Caveats

- **Every move is a breaking change** to an import path. Per `AGENTS.md`, do one
  concern per PR, update every importer in the same PR, and prefix the CHANGELOG
  entry with `**BREAKING CHANGES:**`. Do not leave re-export shims behind.

  **The vocabulary move is the one exception, and for a reason that does not
  generalize.** A re-export is a shim when it keeps a *dead* coupling alive —
  which is the case for every move in the table above, where the whole goal is
  that `fjs/text/sgr` stops naming `effects/node` at all. It is not the case
  for `IoChannel` and its siblings: node's own operations are declared in
  them, so `effects/node` re-exporting what it genuinely uses keeps one
  vocabulary readable at one import rather than preserving a coupling anyone
  wants gone. That is why that move was additive and needed no importer churn,
  and why the moves below still need theirs.
- **The obsolete Playwright adapter is already gone.** This task must preserve
  only the process-side `TestContext` fields that still have consumers. It must
  not use relocation as a reason to revive the Playwright engine, context,
  dynamic import, or Node-side proof-registration path.
- **Verify no new cycles** before each move. In particular `fjs/effects/console`
  needs `Vec` (`fjs/types/bit_vec`) and the `fjs/text` encoders — check that
  none of those import back into `fjs/effects`.
- **Land [allvoid-combinator](./allvoid-combinator.md) after the `All` move**,
  not before, so `allVoid` is written once in its final home.
- **`Test`'s payload references `All` and `Await`** (`:471-472`), so the test
  move should follow the `all` and `sandbox` moves.

### Tasks

- [x] Move the operation vocabulary (`OpResult`, `IoChannel`, `IoError`,
      `IoErrorInfo`, `IoResult`, `ioError`, `toIoError`) to `fjs/effects`,
      with `effects/node` re-exporting it and `effects/memory` taking
      `OpResult` from the core. `isNotFound` stayed — see the judgement calls.
- [ ] Independent of the moves: replace `fjs/media/type`'s `IoResult` import
      with `Result<T, unknown>` from `fjs/types/result`, dropping its
      `effects` import — a pure consumer should not name an IO alias, whichever
      module the alias lives in.
- [ ] Move `All` / `all` / `allOk` / `both` to `fjs/effects/all/module.f.mjs`.
      `allOk` is the ok-channel wrapper over `all` and belongs with it;
      [allvoid-combinator](./allvoid-combinator.md) builds on it, so leaving it
      behind would make `effects/all` import from `effects/node`.
- [ ] Move `Sandbox` / `Await` and helpers to `fjs/effects/sandbox/module.f.mjs`.
- [ ] Move the console family to `fjs/effects/console/module.f.mjs`, add the
      named `Std` type there as `RequiredMap<WriteConsoles, …>`, point
      `NodeProgramOptions.std` at it, and narrow `csiWrite` to take `Std`
      (updating its one caller, `fjs/emergent_testing/module.f.mjs:360`). Verify
      `fjs/text/sgr` no longer imports `effects/node` at all — that is the test
      for this step.
- [ ] Move `Test` / `TestFn` / `TestContext` / `test` to
      `fjs/effects/test/module.f.mjs` — **not** into `fjs/emergent_testing`, which
      would be a cycle (see the judgement call above). Confirm `effects/node`
      still compiles with `NodeOp` and `NodeProgramOptions` importing only the
      surviving process-runner test contexts from there; no Playwright context
      or engine remains.
- [ ] Update the `fjs/effects/node` module header to describe only what remains.
      `deno.json` registration is a no-op today and an obligation later: it has
      no `exports` map (only `tasks` and `fmt`), so the registration rule has no
      entry to add, and a map listing only the new effects modules would
      restrict a currently unrestricted package. Whichever change introduces the
      complete map
      ([group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md))
      must enumerate these modules along with every other `module.f.mjs`.
- [ ] `npx tsc` and `fjs t` after each move; one PR per concern.

### Related

- [allvoid-combinator](./allvoid-combinator.md) — names the `All` lowering as a
  separate design question; this is it.
- [fold-stream-combinator](./fold-stream-combinator.md) — its `Result`-spelled
  signature is the right design for a generic combinator, not the workaround it
  calls itself; that issue needs no change from this one.
- [browser-testing](../../emergent_testing/todo/browser-testing.md) — owns the
  future Playwright adapter and browser-side test report.
- `fjs/media/type/module.f.mjs:45`, `fjs/text/sgr/module.f.mjs:13`,
  `fjs/emergent_testing/module.f.mjs:16-29` — importers that reach into the Node
  module for non-Node things.
- [group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — the same regroup-by-concern exercise one level up, at `fjs/`.
