## spidermonkey-test-runner. Run FunctionalScript proofs on SpiderMonkey

**Priority:** P3
**Status:** open

### Problem

The suite runs on Node, Deno, and Bun, which is two engines: V8 twice and
JavaScriptCore once. SpiderMonkey never executes a proof, so every place where
FunctionalScript depends on engine behaviour — `bigint` size limits (the reason
`ReadFile` caps at 128 KiB, `fjs/effects/node/types.ts`), property enumeration
order, `Number.prototype.toString` digits, thrown-value shapes, tail-call and
recursion depth — is unverified on the third major engine.

The obstacle is the host, not the language. `fjs t` is
`testAll` (`../module.f.mjs`): `loadModuleMap` walks the tree with the
`readdir` and `import` operations, and `runModuleMap` needs `sandbox`, `write`,
and `catch`, plus an exit code and the `env` its options carry — `env` is a
field of `NodeProgramOptions` (`../../effects/node/types.ts`), not an
operation. The only runner that backs them with real
host IO is `../../effects/node/module.mjs`, which imports `node:fs`,
`node:http`, `node:process`, and `node:test` at the top of the file. There is a
second interpreter, `../../effects/node/virtual/module.f.mjs`, and it is
`node:`-free — but it answers `readdir` and `import` from simulated state, so
it cannot discover the real tree, which is what discovery needs. The
SpiderMonkey shell (`js`) has none of the Node APIs — no `node:` namespace and
no package resolution — so loading that runner in the shell fails before any
proof is reached. What the shell does have is enough to back the few
operations `fjs t` uses ([Findings](#findings)).

### Decided

**`fjs t` itself runs on SpiderMonkey, through a partial Node effects host.**
There is no separate SpiderMonkey test runner. A runner of its own would be a
second implementation of what `fjs t` already does: discovery, the `throw`
inversion, walking return values, naming, reporting, the exit code. A second
implementation drifts. The host implements only the operations `fjs t` uses,
and every other Node operation answers `NotImplemented`.

**The deep fixture gets shallower.** The suite should run as much of itself as
possible on every engine, so a fixture that one engine cannot parse is cut to
fit it. This follows the 128 KiB `bigint` cap that Bun set
(`fjs/effects/node/types.ts`).

**The engine decides what `fjs t` loads, not a flag.** On Node, Deno, and Bun,
`fjs t` loads every proof `shouldLoad` accepts, as it does today. On any other
engine it loads only the pure proofs, the authored `.f.mjs` and `.f.js`
modules. An engine `fjs t` does not know is "any other", so a new host starts
with the authored set rather than with proofs it cannot import. SpiderMonkey is
the first such host. The authored set is the most a host without the Node host
can load, not always what it can: the runner compiled to Rust loads only what
the compiler supports, which an authored `.f.mjs` does not promise
([load-proofs-through-fjs](load-proofs-through-fjs.md)), so it will narrow the
set further with a predicate of its own. No new `fjs t` flag is added for this.

The host passes the engine as a field of `NodeProgramOptions`, not through an
`engine` effect. It is a fixed fact about the host, like `args`, `env`, `home`,
and `packageRoot`, which are options; the effects are for IO and
nondeterminism. As a field, `tsc` makes every host set it. The effect's one
advantage would be a free default — a host without the handler answers
`NotImplemented`, read as "pure only" — but that same default lets a Node host
whose handler broke run only the pure proofs and pass, a suite that shrinks
without saying so.

### Findings

Measured on x86-64 Linux with SpiderMonkey 140.14.0, the `spidermonkey_140`
attribute of the Nixpkgs commit the shared flake pins (`5b00df4`), against the
tree at `3e1d1a09`.

**Install.** The pinned Nixpkgs carries `spidermonkey_91`, `spidermonkey_115`,
`spidermonkey_128`, and `spidermonkey_140`. `cache.nixos.org` has
`spidermonkey_140` prebuilt — 34.2 MiB to download, 88.3 MiB unpacked with
its `icu4c` and `nspr` — so nothing is compiled from source. The cache has it
for every system the shared flake builds a shell for (`x86_64-linux`,
`aarch64-linux`, `aarch64-darwin`), so adding it to that shell builds nothing
anywhere. The package puts both `js` and `js140` on `PATH`, and
`js --version` prints `JavaScript-C140.14.0`. Until it is in the shared shell, this runs it
at the pinned version without a separate download:

```sh
nix shell --inputs-from ./gen.nix nixpkgs#spidermonkey_140 -c js --version
```

**API surface.** By default, with no flags, the shell has `print`, `putstr`,
`printErr`, `quit`, `scriptArgs`, `os.getenv`, `os.file.listDir`, `read`,
`snarf`, `readline`, `drainJobQueue`, `console`, and `performance.now`. It has
no `URL`, `TextEncoder`, `TextDecoder`, `setTimeout`, `queueMicrotask`, or
`structuredClone`, and no way to read the working directory or stat a file.
Dynamic `import()` takes an absolute path, and the imported module's relative
imports resolve from its own file. `import.meta.url` is a plain path, not a
`file:` URL. `quit(n)` exits with `n`; an uncaught error exits with `3`.
Promise jobs still queued when the main module finishes run before the shell
exits, without a call to `drainJobQueue`.

**Arguments.** The first positional argument is the main script even with
`--module`: `js --module run.mjs a b` runs `a` as a second script and leaves
`scriptArgs` as `["b"]`. `js --module run.mjs -- a b` gives `["a", "b"]`.

**`fjs t` runs.** A throwaway host of about fifty lines ran the `main` of
`fjs/module.f.mjs` with `t` over the whole repository. 9,828 tests passed, none
failed, the exit code was `0`, and the output was the same reporter output
Node prints. It took about 3 minutes 40 seconds of wall time.

The spike had two hacks that the real host must not copy. Its `readdir` hid
the non-authored proofs (see the selection task below), and it hid the nine
modules that the deep fixture breaks.

The host was `asyncPartialRun(nodeCommands)` (`../../effects/module.mjs`) over
`commonOperationMap` (`../../effects/common/module.mjs`), which supplies
`sandbox` and `catch`, plus four handlers. Everything it imports loads in the
shell.

- **`all`** — `Promise.all` over the runner itself, as Node's is.
- **`readdir`** — `os.file.listDir` answers names only, so an entry's kind is
  whether `listDir` accepts it as a directory. The repository tracks no
  symbolic links; a link to a directory would read as a directory, where
  Node's `Dirent` says it is neither. Entries go through `_orderDirents`, as
  on Node.
- **`import`** — a relative path is resolved from the host's own file, not the
  working directory. The shell cannot read the working directory, so the spike
  made each path absolute against `PWD`.
- **`write`** — `putstr` writes stdout without a newline. Stderr has only
  `printErr`, which appends one, so the spike buffered stderr to line ends.
  `os.file.writeTypedArrayToFile('/dev/stdout', …)` lost its output when
  stdout was redirected to a file, so it is not an option. Without
  `TextDecoder`, the host decodes UTF-8 itself; the real host should use
  `fjs/text/utf8`, not the spike's `escape` trick.

`access` is in `LoadModuleOperations`, but discovery does not call it.

The program options came from the shell:

- `args` from `scriptArgs`;
- `env` built by name, because `os.getenv` cannot list variables — `fjs t`
  reads `INIT_CWD` and `GITHUB_ACTIONS`;
- `std` as not a TTY;
- `home` from `HOME`;
- `packageRoot` from the host's path;
- a `testContext` that refuses, since `register` is not reachable from `fjs t`.

**Discovery takes impure proofs too.** `fjs t` discovers with `shouldLoad`
(`../../dev/module.f.mjs`), which also accepts the 21 impure proofs
(`proof.mjs` and the like). `loadModuleMap` propagates an import failure, so
one proof that reaches `node:` fails the whole run.

**The program is not told its engine.** `NodeProgramOptions` carries `args`,
`env`, `home`, `std`, `testContext`, and `packageRoot`, and none of them names
the engine. Only the hosts detect it: `isBun` (`../../effects/node/module.mjs`)
picks Bun's `testContext` wrapper, and `isNode`
(`../../effects/node/testlib.mjs`) is for impure proofs.

**Divergence: module nesting.** SpiderMonkey's parser rejects a literal nested
deeper than about 870 levels with `InternalError: too much recursion`:

- `parseModule` parses `const x = [[…1…]]` at 876 levels and fails at 877;
- with `export default` in place of `const x =`, it parses at 877 levels;
- a nested object, `{"a":{"a":…}}`, parses at 865 levels;
- a `Function` body parses at 876 levels.

`eval` of a bare nested array passed at 3,999 levels, so `eval` does not
show this limit. Raising `ulimit -s` changes nothing, so the limit is the
shell's own quota, not the OS stack. Whether Firefox has the same limit is not
measured. Node 26 imports a module whose literal is nested 1,500 levels deep.

`spec/datajs/vectors/accept/data.f.js` spells the `array-nested-deep` graph as
a literal nested 1,000 levels deep. So that module fails to parse, and so does
every module that imports it:

- `spec/datajs/vectors/accept/proof.f.mjs`;
- `fjs/media/datajs/vectors/proof.f.mjs`;
- `fjs/media/datajs/vectors/matrix/module.f.mjs` and its `proof.f.mjs`;
- `fjs/dev/gen/module.f.mjs` and its `proof.f.mjs`;
- `fjs/compiler/proof.f.mjs` and `fjs/compiler/language.proof.f.mjs`.

The vector's `document` is a string that the DataJS parser reads, but its
`graph` is a literal that the engine parses, so the graph is what has to fit
under the limit, with a margin.

**Divergence: call depth.** A recursive one-line arrow function reaches 5,998
calls in the shell and 9,627 in Node 26.11.1, both with their default stacks.
[stack-safety](../../edag/todo/stack-safety.md) measures its stack margin on
Node; with about 40% fewer frames available here, that margin is likely
smaller in the shell. No proof hit the call-depth limit in either spike.

### Proposal

**Take the simplest thing that runs `fjs t` on SpiderMonkey, and keep taking
it.**

1. **A partial Node effects host for the shell,** a sibling of
   `../../effects/node/module.mjs` with no `node:` imports. It runs the `main`
   of `fjs/module.f.mjs`, the same program the `fjs` CLI runs, through
   `asyncPartialRun(nodeCommands)`. It has `commonOperationMap` and the four
   handlers in [Findings](#findings), and nothing else until a command needs
   it. It builds the program options from the shell and `quit`s with the
   program's exit code. Other `fjs` commands answer `NotImplemented` for
   operations the host lacks.

   **`npm run sm-test` runs it,** a `package.json` script for
   `js --module <host> -- t`. It works as `npm start test` does. npm runs the
   script from the package root and passes the directory it was invoked from
   as `INIT_CWD`; the host passes that on to `fjs t`, so
   `cd fjs/types && npm run sm-test` tests that subtree. `INIT_CWD` is an
   absolute path, so every path discovery hands `import` is absolute too, and
   the host never needs the working directory the shell cannot read. `js`
   comes from the Nix shell, so outside it the script fails with
   `js: not found`. Only `npm test` and `npm start` work without `run`, and
   `npm sm-test` is `Unknown command`.

   The host is a boundary — shell globals, `import()`, and the `try`/`catch`
   that turns a host failure into an `IoResult` — so it is a plain `.mjs`, and
   it is kept thin
   ([AGENTS.md §3](../../../AGENTS.md#3-functionalscript-and-typescript-fjs)).
   It reuses what exists rather than copying it: `asyncPartialRun`,
   `commonOperationMap`, `_orderDirents`, `fromVec`, and `fjs/text/utf8`. Any
   rule it grows beyond the host calls belongs in a `.f.mjs` module with its
   proof.

2. **Every host tells the program its engine, and `fjs t` selects by it.**
   `NodeProgramOptions` gains a field naming the engine — for example
   `engine: 'node' | 'deno' | 'bun' | 'spidermonkey'`. The Node host sets it
   from what it already detects, and the SpiderMonkey host sets its own name.
   The options describe the host; the rule that turns the engine into a
   selection is `fjs t`'s, so it lives in FunctionalScript with its proof.
   Outside Node, Deno, and Bun, `fjs t` loads authored modules only — the same
   scope the browser suite has ([README](../README.md#scope)). An authored
   module that fails to import still fails the run.

3. **Nix is how the shell gets installed.** Add `spidermonkey_140` to
   `devNixJob`'s shared package list (`../../ci/dev/module.f.mjs`,
   [fjs/ci/nix/README.md](../../ci/nix/README.md)) once the host works, so
   local runs and CI use the same binary at the version the accepted Nixpkgs
   pin decides. The generator writes only the shared flake. Do not restore
   `nodeNixJobs`, `nixJobs`, `nixFlakes`, or per-job path selectors to add this
   runtime. A separate flake would need a concrete reason and a newly scoped
   design.

4. **CI runs it in the `ubuntu-arm` job, not a new one.** The bottleneck is
   the number of jobs, not their time: each job waits for its own runner, the
   ARM pool is congested, and merging many pull requests queues this
   repository's own jobs behind each other
   ([six-ci-jobs](../../ci/todo/six-ci-jobs.md)). That issue makes
   `ubuntu-arm` the primary job, and moves `node26`, `deno`, and `bun` into it,
   so these steps go where the other runtimes are heading. The job grows by
   about the spike's 3 minutes 40 seconds — measured on a different machine,
   so measure it on the runner — which is the trade that issue accepts.

   The steps are the ones every Nix job has, one command each
   ([AGENTS.md §7](../../../AGENTS.md#7-continuous-integration)): assert the
   pinned version with `js --version` against a pin in
   `../../ci/config/module.f.js`, as `bunSteps` asserts Bun's, then
   `npm run sm-test`, the same command a developer runs. The version check
   joins the job's other version
   checks, which come before any other command (`nixVersionChecks` in
   `../../ci/proof.f.mjs`). `fjs t` writes nothing to the tree, so the step
   order six-ci-jobs sets for steps that write does not constrain it.

   `ubuntu-arm` already took in the `wasm` job the same way:
   `shellPlatformSteps` (`../../ci/module.f.mjs`) adds the WASM runtimes'
   version checks and targets on ARM Linux only, chosen by `wasmPlatform`
   (`../../ci/rust/module.f.mjs`). The SpiderMonkey steps are chosen for the
   same platform, but they do not depend on the project having Rust, as the
   WASM steps do.

### Tasks

- [x] Confirm a SpiderMonkey package on the accepted Nixpkgs commit: see
      [Findings](#findings).
- [x] Check what the shell provides — output, exit code, arguments,
      environment, job queue, module loading.
- [x] Run `fjs t` through a throwaway partial host.
- [ ] Make `array-nested-deep` in `spec/datajs/vectors/accept/data.f.js`
      shallow enough to parse in SpiderMonkey with a margin, and check every
      other fixture against the same limit. Update the prose that cites the
      thousand levels ([stack-safety](../../edag/todo/stack-safety.md)), and
      run `npm run gen` in case the change reaches a generated file.
- [ ] Add the engine to `NodeProgramOptions`, set by every host, and have
      `fjs t` load only authored modules when the engine is not Node, Deno, or
      Bun.
- [ ] Add the host and the `sm-test` script, and run `npm run sm-test` on the
      whole tree with no hidden modules, and from a subdirectory. Check in the
      shell that a failing proof exits `1`, and that a module that fails to
      import fails the run.
- [ ] Add `spidermonkey_140` to `devNixJob` and its version pin to
      `../../ci/config/module.f.js`, then add the version check and
      `npm run sm-test` steps to the `ubuntu-arm` platform job. Run
      `npm run gen` and commit the regenerated workflow. Add the
      `npm run sm-test` row to the runtime table in
      [CONTRIBUTING.md](../../../CONTRIBUTING.md).
- [ ] Document every engine divergence the run finds next to the code it
      constrains, starting with the two in [Findings](#findings).

### Out of scope

- Operations `fjs t` does not use. Another `fjs` command on SpiderMonkey
  answers `NotImplemented` until something concrete needs it there.
- New `fjs t` flags. Selection by argument is
  [run-subset-of-tests](run-subset-of-tests.md)'s; this issue selects by
  engine.
- Making SpiderMonkey a supported runtime for the `fjs` CLI as a whole.
- The impure `.mjs` proofs, and integration tests that need real IO (`http`,
  `childProcess`, filesystem writes).
- Registration with an external test framework (`register` in
  `../module.f.mjs`): the shell has no framework to register with.
- Coverage.

### Related

- [browser-testing](browser-testing.md) — another host that runs only
  authored proofs; its scope rule is the one this host selects by.
- [stack-safety](../../edag/todo/stack-safety.md) — the thousand-level vector
  is a stack margin there too, and the shell's smaller call depth shrinks it.
- [six-ci-jobs](../../ci/todo/six-ci-jobs.md) — makes `ubuntu-arm` the one
  primary job, which is why SpiderMonkey's steps go there.
- [node-module-layering](../../effects/todo/node-module-layering.md) — lowering
  the runtime-agnostic operations out of `fjs/effects/node` is what lets a
  non-Node host implement a subset without depending on the Node module.
- [load-proofs-through-fjs](load-proofs-through-fjs.md) — the runner compiled
  to Rust, which loads less than the authored set: only what the compiler
  supports.
- [run a subset of proofs](run-subset-of-tests.md) — selection by `fjs t`
  arguments; both selections end in the predicate `allFiles` takes.
