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
| `All` / `all` / `both` (`:38-54`) | concurrency; runner infrastructure, no host API |
| `Await` / `awaitIfPromise` (`:437-444`) | host promise interop — every JS runtime |
| `Sandbox` / `SandboxResult` / `sandbox` (`:399-428`) | measured, exception-trapping invocation of a plain function |
| `Now` (`:385`), `RandomInt` (`:152`) | ambient values, not filesystem |
| `Test` / `TestFn` / `TestContext` (`:446-473`) | registration with an external test framework; `fjs/emergent_testing` is the only consumer |
| `Write` / `Read` / `log` / `error` / `readLine` (`:301-381`) | console streams |

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

2. **`fjs/text/sgr/module.f.ts:11`** — an ANSI SGR module imports `write`,
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
| `fjs/effects/all/module.f.ts` | `All`, `all`, `both`, and `allVoid`/`allReduce` when they land |
| `fjs/effects/sandbox/module.f.ts` | `Sandbox`, `SandboxResult`, `sandbox`, `Await`, `awaitIfPromise` — the "run foreign code and observe what happened" pair |
| `fjs/effects/console/module.f.ts` | `Read`, `Write`, `ReadConsoles`, `WriteConsoles`, `Console`, `log`, `error`, `readLine`, `errorExit`, and a **new named `Std`** (see below) |
| `fjs/effects/test/module.f.ts` | `Test`, `TestFn`, `TestContext`, `test` — registration with an external framework, not I/O |
| stays in `fjs/effects/node` | `Fs` and its members, `Http`, `Fetch`, `Import`, `Forever`, `Now`, `RandomInt`, `IoResult`, `isNotFound`, `Env`, `Engine`, `NodeOp`, `NodeProgramOptions`, `Program`, `NodeProgram`, `NodeOperationMap` |

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
  *is* a Node concern.
- **`IoResult<T>` stays too — pure consumers should stop importing it instead.**
  An earlier draft of this issue moved it to the effects core, on the reasoning
  that core already imports `Result` so the move costs no new dependency. That
  reasoning picks a destination by convenience rather than by concern, and the
  destination is wrong on its own terms: `Result<T, unknown>` is not an effect
  constructor or combinator, so moving it would swap Node coupling for
  core-effects coupling and leave a non-effect type in the effects core.
  `fjs/types/result` is not the answer either — the *name* is about the host I/O
  boundary ("the error is whatever the host threw"), and a generic types module
  should not mint I/O vocabulary.

  Read the other way, `IoResult` is exactly a Node-layer contract and belongs
  beside the operations it describes. The fix for a **pure** consumer is to
  spell the underlying type, not to relocate the alias:
  `fjs/media/type/module.f.ts:40` imports `type IoResult` from
  `../../effects/node/module.f.ts` purely to write `IoResult<Vec>` and
  `IoResult<DetectMeta>`; writing `Result<Vec, unknown>` from
  `fjs/types/result` says the same thing and drops the `effects/node` import
  **entirely**, which is a better outcome than moving where it points.
  [fold-stream-combinator](./fold-stream-combinator.md) reached the same
  conclusion independently for `fjs/effects/list` — its `Result`-spelled
  signature is the right design, not the workaround that issue calls it.

  This is an independent, one-site cleanup: it neither depends on nor supports
  the moves below. Listed here because that is where the wrong answer was
  written down; it can land on its own.
- **`Test` goes to an effects module, not to `fjs/emergent_testing`.**
  `emergent_testing` looks like the natural owner — it is the only consumer of
  `test` and the module that defines what a test *is* — but putting the
  declarations there is a cycle, not a layering. Two contracts `effects/node`
  keeps refer to them: `NodeOp` unions `Test`
  (`fjs/effects/node/module.f.ts:492`) and `NodeProgramOptions` carries the
  `TestContext` fields used by the surviving process-side test adapters. Those
  are runner configuration and stay in `effects/node` — so `effects/node` would
  have to import `emergent_testing`, while `emergent_testing/module.f.ts:21-24`
  keeps importing `NodeProgram`, `NodeProgramOptions` and `Program` back from
  `effects/node`. `fjs/effects/test/module.f.ts` sits below both, so both may
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
  `fjs/text/sgr/module.f.ts` from `effects/node`, because `csiWrite` (`:90-98`)
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
  // fjs/effects/console/module.f.ts
  import type { StringMap } from '../../types/object/module.f.ts'

  export type Std = StringMap<WriteConsoles, { readonly isTTY: boolean }>

  // fjs/text/sgr/module.f.ts
  export const csiWrite = (std: Std) => (stream: WriteConsoles) => …
  ```

  Note the `StringMap` spelling: `AGENTS.md` requires the `fjs/types/object`
  record types for *all* string-keyed record types, and over a finite key union
  `StringMap<WriteConsoles, T>` resolves to the same required-field record the
  inline mapped type produces.
  `NodeProgramOptions.std` (`fjs/effects/node/module.f.ts:535`) writes that
  inline form by hand today — a pre-existing deviation from the rule, in a
  module that already imports the open-key-set `Map` at `:19` and uses it for
  `Headers` and `Module`. Pointing `std` at the named `Std` fixes that as a side
  effect and keeps the runner contract in sync with the console module by
  construction.

  `csiWrite` has one caller — `fjs/emergent_testing/module.f.ts:370`,
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

- [ ] Independent of the moves: replace `fjs/media/type`'s `IoResult` import
      with `Result<T, unknown>` from `fjs/types/result`, dropping its
      `effects/node` import. `IoResult` itself does **not** move.
- [ ] Move `All` / `all` / `both` to `fjs/effects/all/module.f.ts`.
- [ ] Move `Sandbox` / `Await` and helpers to `fjs/effects/sandbox/module.f.ts`.
- [ ] Move the console family to `fjs/effects/console/module.f.ts`, add the
      named `Std` type there as `StringMap<WriteConsoles, …>`, point
      `NodeProgramOptions.std` at it, and narrow `csiWrite` to take `Std`
      (updating its one caller, `fjs/emergent_testing/module.f.ts:370`). Verify
      `fjs/text/sgr` no longer imports `effects/node` at all — that is the test
      for this step.
- [ ] Move `Test` / `TestFn` / `TestContext` / `test` to
      `fjs/effects/test/module.f.ts` — **not** into `fjs/emergent_testing`, which
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
      must enumerate these modules along with every other `module.f.ts`.
- [ ] `npx tsc` and `fjs t` after each move; one PR per concern.

### Related

- [allvoid-combinator](./allvoid-combinator.md) — names the `All` lowering as a
  separate design question; this is it.
- [fold-stream-combinator](./fold-stream-combinator.md) — its `Result`-spelled
  signature is the right design for a generic combinator, not the workaround it
  calls itself; that issue needs no change from this one.
- [browser-testing](../../emergent_testing/todo/browser-testing.md) — owns the
  future Playwright adapter and browser-side test report.
- `fjs/media/type/module.f.ts:40`, `fjs/text/sgr/module.f.ts:11`,
  `fjs/emergent_testing/module.f.ts:14-30` — importers that reach into the Node
  module for non-Node things.
- [group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — the same regroup-by-concern exercise one level up, at `fjs/`.
