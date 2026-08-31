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
provides*.

**One destination, `fjs/effects/common`, not one per family.** This table
originally proposed `effects/all`, `effects/sandbox`, `effects/console` and
`effects/test` — four directories, each holding one family. The project's
direction settles it the other way: the goal is to reduce the JavaScript, put
the logic in FunctionalScript, and have every host talk to it through generic
effects, with a `fjs/effects/browser` interpreter joining `fjs/effects/node`.
Under that goal the meaningful axis is *which host implements this*, not *what
concern is it* — and the answer for these families is "more than one", which is
one bucket. Four directories would name the concerns at the cost of making
"what does a second host have to implement" something a reader assembles from
four imports. The rows below keep their groupings as the order the moves happen
in; the destination is `fjs/effects/common` for all of them.

Proposed destinations:

| Moves to | Contents |
|---|---|
| `fjs/effects/common` (was `effects/all`) | `All`, `all`, `allOk`, `both` — **moved** on the layering argument alone; `allVoid`/`allReduce` when they land. Its implementers today are still the Node runners and the registration path: the page's `Promise.all` coordinates module-loading promises directly, and its interpreter claims `Catch`, `Sandbox` and `report` and nothing else. Giving `all` a browser implementer is the *plan* for the loading walk, not a fact about the tree |
| `fjs/effects/common` (was `effects/sandbox`) | `Sandbox`, `SandboxResult`, `sandbox`, `Await`, `awaitIfPromise`, and `Catch`/`catch_` (landed after this table was written) — the "run foreign code and observe what happened" family. This row is what [share-browser-console-runner](../../emergent_testing/todo/share-browser-console-runner.md) step 4's "shared module" resolves to: a browser gives `Sandbox` and `Catch` their second implementer; `Await` moves on this issue's layering argument alone, since it belongs to the registration path no browser runs |
| `fjs/effects/common` (was `effects/console`) | `Read`, `Write`, `ReadConsoles`, `WriteConsoles`, `Console`, `log`, `error`, `readLine`, `errorExit`, and a **new named `Std`** (see below) |
| `fjs/effects/common` (was `effects/test`) | `Test`, `TestFn`, `TestContext`, `test` — registration with an external framework, not I/O |
| stays in `fjs/effects/node` | `Fs` and its members, `Http`, `Forever`, `RandomInt`, `isNotFound`, `Env`, `Engine`, `NodeOp`, `NodeProgramOptions`, `Program`, `NodeProgram`, `NodeOperationMap` |
| `fjs/effects/common` (was staying) | `Module`, `Import`, `import_` — **moved**: a browser page loads modules too, and had been doing it through an injected `importer` callback, which was the operation under another name (see the judgement call below) |
| stays, now settled | `Now`, `Fetch` — the browser interpreter implements neither: a page measures its own wall clock rather than dispatching `now`, and performs no `fetch` at all |
| already moved to `fjs/effects` | `OpResult`, `IoChannel`, `IoError`, `IoErrorInfo`, `IoResult`, `ioError`, `toIoError` — the vocabulary every operation is declared in; `effects/node` re-exports them (see the judgement call below) |

`NodeOp` stays where it is and keeps unioning every family — it is the
*runner's* op-set, which is legitimately "everything this host can do", and both
interpreters (`fjs/effects/node/module.mjs`, `fjs/effects/node/virtual`) keep a
single place to enumerate. Only the *declaration* of each family moves; the
union that names them all does not.

Judgement calls worth deciding explicitly rather than by accident:

- **`RandomInt` stays.** An ambient host capability with no cross-runtime
  abstraction to gain and no consumer outside `fjs/cas` and the interpreters.
  Moving it would be motion without a reader benefit.
- **`Now` and `Fetch` stay; `Import` moved, and both halves were settled by
  building the browser interpreter rather than by arguing.** This issue and
  [share-browser-console-runner](../../emergent_testing/todo/share-browser-console-runner.md)
  step 4 disagreed: this file put all three in "stays" on the reader-benefit
  argument, that one listed them among the operations to move. Neither was
  written knowing the fact that decides it — which operations a browser
  interpreter actually implements — so both recorded the disagreement and left
  it to step 5.

  Step 5's answer was `sandbox`, `catch` and `all`, and nothing else: the
  browser interpreter built (and later reverted, with its record) in
  functionalscript#1759 implemented those three because the shared proof
  traversal performed those three. A page loads its modules through its own
  importer rather than an `import` operation, measures its own wall clock
  rather than dispatching `now`, and performs no `fetch` at all. So none of
  the three gained a second implementer, and DESIGN.md §4 keeps them here
  until one does.

  **`Import` since gained one, and the measurement had been reading it wrong.**
  "A page loads its modules through its own importer" described a *callback*
  parameter — `startBrowserTestSources(root, sources, importer)` — which is
  what an operation is when it has not been named: a capability the caller
  supplies because the interpreter does not. Counting implementers by which
  operations a runner dispatches missed it, because the seam was an argument
  rather than a command. Named, `import` has the two implementers the rule
  asks for: Node's `asyncImport` and the page's own `import()`, one resolving
  against a filesystem and the other against a document — which is the
  interpreter's business and not the operation's. The lesson generalises: an
  injected function is an unnamed operation, so the honest question is not
  "which operations does this host dispatch" but "which capabilities does it
  need supplied". The sequential plan that replaced that attempt (see
  share-browser-console-runner) shrinks the measured set once more: a
  sequential traversal performs no `all`, so the operations a browser gives a
  second implementer are `sandbox` and `catch` alone. That takes `all` out of
  *step 4's* motivation, not out of this issue's: its move to `effects/all`
  above rests on the layering argument, and its implementers stay the Node
  runners and the registration path.

  **That is still true after the move**, and worth saying because the move
  invites the opposite reading. `all` is in `effects/common` because fan-out is
  an interpreter's job, not because a browser dispatches it — the page's
  `Promise.all` coordinates promises directly and its interpreter does not
  claim `all` at all. It is expected to: moving the browser's module loading
  into `.f.mjs` needs a fan-out the walk does not perform itself, which is what
  the operation is for. Until that lands, this row's second implementer is a
  plan, and a plan recorded as a fact is how a design comes to hold two
  incompatible things at once.

  Worth recording, because the earlier expectation written here was wrong about
  two of them: "a browser proof run needs a clock and dynamic import" is true of
  the *page* and false of the *effect set* — the page does both directly, in the
  impure shell where host values belong, which is exactly the boundary this
  whole exercise is drawing. Reasoning from what a host can do predicted the
  wrong answer; reading what the interpreter had to implement gave the right
  one.
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

  **The exception is decided by a test, not by a list.** A re-export is a shim
  when it keeps a *dead* coupling alive; it is legitimate where the
  re-exporting module genuinely uses the names. The vocabulary move passed
  that test — node's own operations are declared in `IoChannel` and its
  siblings — and so does the whole sandbox row, `Await` included: `NodeOp` is
  declared over `Sandbox`, `Catch` and `Await`, and both node runners
  implement all three, so `effects/node` re-exporting them keeps one
  operation set readable at one import for node-side callers, while the
  modules the move exists for (the shared traversal, a browser interpreter)
  import the new home directly. The sandbox row's move is therefore
  additive — and so is the `all` row's, by the same test applied honestly:
  `NodeOp` unions `All` and both node runners implement it, so `effects/node`
  re-exporting it is the same one-import convenience, not a dead coupling.
  The console and test rows *split* under the same test rather than failing
  it wholesale, because the test applies per name, not per concern: the
  surviving `effects/node` declarations still reference the operation
  types — `NodeOp` unions `Read`, `Write` and `Test`, and
  `NodeProgramOptions` names `WriteConsoles` and `TestContext` — so those
  names stay re-exported by the same argument as `Sandbox` and `All`. The
  test reaches the helpers one name at a time, the surviving *code* counts
  as much as the declarations, and it is applied to the module **as it
  stands after the move**: `exitStep` stays — it is the node program's
  exit-code policy, consumed repo-wide — and it calls `errorExit`, so
  `errorExit` stays re-exported. `errorExit`'s own call to `error` moves to
  the console module with its body, and nothing that remains in
  `effects/node` references `error` after that — so `error` is *not* kept
  by `errorExit`'s keeping, and joins `log`, `readLine` and the `test`
  combinator as the dead couplings: their consumers are exactly the ones
  the moves exist to decouple, so they move as hard cutovers, every
  importer updated in the same PR, no re-export left behind. Draw the exact
  split at move time by this test — grep what the post-move `effects/node`
  declarations *and function bodies* reference — and note
  that the decoupling each move exists for is enforced by its own step's
  check (`fjs/text/sgr` no longer importing `effects/node`), which a type
  re-export for node-side callers does not weaken.
  [share-browser-console-runner](../../emergent_testing/todo/share-browser-console-runner.md)
  step 4 states the same policy from its side.
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

### Six operation tuples are not `readonly`

`Fetch`, `CreateServer`, `Listen` and `Forever` in
[`../node/types.ts`](../node/types.ts), and `All` in
[`../common/types.ts`](../common/types.ts), are declared as plain tuples where
every other operation is `readonly`. `Import` was a sixth until it moved, and
making it `readonly` on the way looked like tidying — but a `readonly` tuple is
not assignable to a mutable one, so it is a break a consumer could hit, for
cosmetics. It was reverted rather than shipped with a `**BREAKING CHANGES:**`
entry attached to a rename; `All` moved afterwards and kept its plain tuple for
the same reason.

The five that remain are worth aligning *deliberately*, in one change that says
so and takes the version bump for the set rather than smuggling it inside a
move. Nothing depends on it.

### Tasks

- [x] Move the operation vocabulary (`OpResult`, `IoChannel`, `IoError`,
      `IoErrorInfo`, `IoResult`, `ioError`, `toIoError`) to `fjs/effects`,
      with `effects/node` re-exporting it and `effects/memory` taking
      `OpResult` from the core. `isNotFound` stayed — see the judgement calls.
- [ ] Independent of the moves: replace `fjs/media/type`'s `IoResult` import
      with `Result<T, unknown>` from `fjs/types/result`, dropping its
      `effects` import — a pure consumer should not name an IO alias, whichever
      module the alias lives in.
- [x] Move `All` / `all` / `allOk` / `both` to `fjs/effects/common`.
      `allOk` is the ok-channel wrapper over `all` and belongs with it;
      [allvoid-combinator](./allvoid-combinator.md) builds on it, so leaving it
      behind would make the combinator import from `effects/node`.
- [x] Move `Sandbox` / `SandboxResult` / `sandbox` and `Catch` / `catch_` to
      `fjs/effects/common` — first, and without `Await`. These two are the
      operations a browser interpreter implements (see the judgement call
      above), so they are the ones a second host was blocked on; `Await`
      belongs to the registration path no browser runs and moves on the
      layering argument alone, which is not urgent.
- [x] Move `Sandbox`'s and `Catch`'s *handlers* — the impure `sandbox` clock
      helper and the `catch` thunk — to `fjs/effects/common/module.mjs`, which
      `effects/node`'s runner spreads into its own operation map. Declaring an
      operation in a shared layer while each host writes its own copy of the
      obvious implementation would leave the JavaScript where it was; a browser
      interpreter spreads the same object.
- [ ] `fjs/effects/browser`: **still nothing to put in it, and now that is a
      measurement rather than a guess.** Step 7b of
      [share-browser-console-runner](../../emergent_testing/todo/share-browser-console-runner.md)
      has landed — the page runs the shared traversal — and its interpreter is
      `asyncRun` over `commonOperationMap` plus the page's own `report`
      operation, which belongs to `emergent_testing` because rendering a result
      into a document is that host's, not an effect layer's. So what the second
      host needed was these operations moving *out* of `effects/node`, which is
      what the rows above did. This row stays open for the first operation a
      browser implements that a page does not own; there is none today.
- [ ] Move `Await` / `awaitIfPromise` to `fjs/effects/common`.
- [x] Move the console family to `fjs/effects/common`, add the
      named `Std` type there as `RequiredMap<WriteConsoles, …>`, point
      `NodeProgramOptions.std` at it, and narrow `csiWrite` to take `Std`
      (updating its one caller in `fjs/emergent_testing/module.f.mjs`). Verify
      `fjs/text/sgr` no longer imports `effects/node` at all — that is the test
      for this step, and it passes for the directory rather than the module:
      the proof had reached for the *virtual node runner* to give its bytes
      somewhere to land, and now claims `write` on a mock, which is the same
      coupling one file over. The family also gained the co-located proofs it
      never had — `log`, `error`, `errorExit`, `read` and `readLine` were
      covered only incidentally, through `protocol/mcp/stdio`, `web` and
      `emergent_testing`.
- [ ] Move `Test` / `TestFn` / `TestContext` / `test` to
      `fjs/effects/common` — **not** into `fjs/emergent_testing`, which
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
- [ ] `tsc` and `fjs t` after each move; one PR per concern.

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
