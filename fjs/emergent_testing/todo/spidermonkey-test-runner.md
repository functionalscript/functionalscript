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
and `await`, plus an exit code and the `env` its options carry — `env` is a
field of `NodeProgramOptions` (`../../effects/node/types.ts`), not an
operation. The only runner that backs them with real
host IO is `../../effects/node/module.mjs`, which imports `node:fs`,
`node:http`, `node:process`, and `node:test` at the top of the file. There is a
second interpreter, `../../effects/node/virtual/module.f.mjs`, and it is
`node:`-free — but it answers `readdir` and `import` from simulated state, so
it cannot discover the real tree, which is what discovery needs. The
SpiderMonkey shell (`js`) has none of the Node APIs — no `node:` namespace and
no package resolution — so loading that runner in the shell fails before any
proof is reached. What the shell does have is enough to discover and load the
tree itself ([Findings](#findings)).

### Findings

Measured on x86-64 Linux with SpiderMonkey 140.14.0, the `spidermonkey_140`
attribute of the Nixpkgs commit the shared flake pins (`5b00df4`), against the
tree at `3e1d1a09`.

**Install.** The pinned Nixpkgs carries `spidermonkey_91`, `spidermonkey_115`,
`spidermonkey_128`, and `spidermonkey_140`. `cache.nixos.org` has
`spidermonkey_140` prebuilt — 34.2 MiB to download, 88.3 MiB unpacked with
its `icu4c` and `nspr` — so nothing is compiled from source. The package puts
both `js` and `js140` on `PATH`. Until it is in the shared shell, this runs it
at the pinned version without a separate download:

```sh
nix shell --inputs-from ./gen.nix nixpkgs#spidermonkey_140 -c js --version
```

**API surface.** By default, with no flags, the shell has `print`, `putstr`,
`quit`, `scriptArgs`, `os.getenv`, `os.file.listDir`, `read`, `snarf`,
`readline`, `drainJobQueue`, and `console`. Dynamic `import()` takes an absolute
path, and the imported module's relative imports resolve from its own file.
`quit(n)` exits with `n`; an uncaught error exits with `3`. Promise jobs still
queued when the main module finishes run before the shell exits, without a call
to `drainJobQueue`.

**Arguments.** The first positional argument is the main script even with
`--module`: `js --module run.mjs a b` runs `a` as a second script and leaves
`scriptArgs` as `["b"]`. `js --module run.mjs -- a b` gives `["a", "b"]`.

**A spike ran the suite.** It was a throwaway shell-side runner of about thirty
lines:

- it walked the tree with `os.file.listDir`, skipping what `isThirdParty`
  (`../../dev/module.f.mjs`) names;
- it loaded each `.f.mjs` and `.f.js` module with its own dynamic `import()`;
- it collected the `proof` export's leaves with `collectTests` and named them
  with `fmtImport`, both imported from `../module.f.mjs`;
- it called each leaf inside `try`/`catch`, inverted the `throw`-tagged
  leaves, and walked the return values.

Over `fjs/` and `spec/`, 289 modules export a `proof`. Their 9,820 leaves all
passed. Nine modules failed to load, all for one reason, the module nesting
limit below. The `fjs/` half took about 3 minutes 40 seconds of wall time.

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

**Decided: the fixture gets shallower.** The suite should run as much of
itself as possible on every engine, so a fixture that one engine cannot parse
is cut to fit it. This follows the 128 KiB `bigint` cap that Bun set
(`fjs/effects/node/types.ts`). The vector's `document` is a string that the
DataJS parser reads, but its `graph` is a literal that the engine parses, so
the graph is what has to fit under the limit, with a margin.

**Divergence: call depth.** A recursive one-line arrow function reaches 5,998
calls in the shell and 9,627 in Node 26.11.1, both with their default stacks.
[stack-safety](../../edag/todo/stack-safety.md) measures its stack margin on
Node; with about 40% fewer frames available here, that margin is likely
smaller in the shell. No proof hit the call-depth limit in the spike.

### Proposal

**Take the simplest thing that runs proofs on SpiderMonkey, and keep taking it.**
Everything below is the simplest path found so far, not a design to defend: if
the shell can run the suite with less machinery, that is the solution, and this
issue should shrink to it. Nothing here is worth building for its own sake.

The [Findings](#findings) made the earlier plan unnecessary. That plan
generated, on Node, one entry file that statically imported every accepted
proof module. The shell lists directories and imports modules by path itself,
so it discovers the tree at run time and needs no generated file.

1. **A shell-side runner,** run with
   `js --module <runner> -- <root> [<subdir>]`. It walks the tree under the
   root (or the subdirectory), selects the authored modules, imports each with
   its own `import()`, runs every leaf of its `proof` export, `print`s the
   failures and a summary, and `quit`s with `1` if anything failed or failed to
   load.

   The runner is a host boundary — `print`, `quit`, `os.file.listDir`,
   `import()`, and the `try`/`catch` the leaves need — so it is a plain
   `.mjs`, and it is kept thin
   ([AGENTS.md §3](../../../AGENTS.md#3-functionalscript-and-typescript-fjs)).
   It reuses what exists instead of copying it: `isThirdParty` for the
   directories it skips, `collectTests` for the leaves, and `fmtImport` for
   their names. Any rule that grows beyond those belongs in a `.f.mjs` module
   with its proof.

   Four details are not optional, because the existing suite depends on each.

   **Select authored FunctionalScript only.** Selecting `.f.mjs` and `.f.js`
   is the same rule the browser suite follows
   ([README](../README.md#scope)). Authored modules do not reach `node:` or a
   package, so nothing needs to be excluded ahead of time. The spike loaded
   every one except the modules that import the deep fixture.

   **Import each module separately, and report a failed import as a
   failure.** An import that fails, as the deep fixture's do, fails that one
   module, not the run. It is counted and named in the output, and it fails
   the exit code. A module silently missing from the count is a suite that
   shrinks without saying so.

   **Invert the `throw`-tagged calls.** FunctionalScript has no `try`/`catch`,
   so a test that a call throws is written by nesting it under a `throw` key
   ([fjs/AGENTS.md §1.5](../../AGENTS.md#15-never-use-trycatch-test-throwing-with-the-throw-key)),
   and `collectTests` carries that down as `throws`. The runner has to read the
   flag and invert: a throw is the pass and a clean return is the failure, as
   `defaultTest` (`../module.f.mjs`) does. A walker that only counts thrown
   errors as failures reports every expected throw in `fjs/asserts/proof.f.mjs`
   as broken, and passes a `throw` test that quietly stopped throwing. That
   second failure is the worse one, because it reads as green.

   **Walk return values, not just the exported tree.** A test function may
   return a further sub-tree of test functions, and the suite uses it —
   `fjs/crypto/sha2/proof.f.mjs` returns its `s256` and `s224` cases from
   `base.b32`. A walker that calls the outer function and stops counts one pass
   and silently skips the assertions inside. Recurse into each non-`throw`
   call's return value, with `null` marking the call boundary so paths render
   as `outer().inner`, as `runModule` and `registerModule` (`../module.f.mjs`)
   already do. `collectTests` itself walks only the static tree and calls
   nothing; those two hand it each `[...path, null]` after a call returns.

2. **Nix is how the shell gets installed.** Add `spidermonkey_140` to
   `devNixJob`'s shared package list (`../../ci/dev/module.f.mjs`,
   [fjs/ci/nix/README.md](../../ci/nix/README.md)) once the runner works, so
   local runs and CI use the same binary at the version the accepted Nixpkgs
   pin decides. The generator writes only the shared flake. Do not restore
   `nodeNixJobs`, `nixJobs`, `nixFlakes`, or per-job path selectors to add this
   runtime. A separate flake would need a concrete reason and a newly scoped
   design.

That is the whole first version. It deliberately does **not** port the effects
layer: no `Effect` runner, no `ModuleMap`, no `sandbox`/`write`/`await`
operations, no `Reporter`. `runModuleMap` and the operations behind it are the
Node runner's business, and reaching for them means writing a second host
runner (a sibling of `../../effects/node/module.mjs` with no `node:` imports)
before knowing whether a `print`-and-`quit` script would have done. Do that
only when something concrete demands it, such as the shared reporter output,
and only for the operations that demand it.

### Tasks

- [x] Confirm a SpiderMonkey package on the accepted Nixpkgs commit: see
      [Findings](#findings).
- [x] Check what the shell provides — output, exit code, arguments,
      environment, job queue, module loading — and whether a generated entry
      file is needed. It is not.
- [ ] Make `array-nested-deep` in `spec/datajs/vectors/accept/data.f.js`
      shallow enough to parse in SpiderMonkey with a margin, and check every
      other fixture against the same limit. Update the prose that cites the
      thousand levels ([stack-safety](../../edag/todo/stack-safety.md)), and
      run `npm run gen` in case the change reaches a generated file.
- [ ] Add the shell-side runner and wire it to an `fjs` command.
- [ ] Fixtures, each verified to run in the shell, not just to load:
      - a passing proof;
      - a failing proof;
      - a `throw`-tagged proof in both directions (throwing passes, returning
        normally fails);
      - a proof whose test returns a sub-tree;
      - a module that fails to import and must be reported, not skipped.
- [ ] Add `spidermonkey_140` to `devNixJob`, then a CI job (`../../ci/`) that
      runs the runner. Add the row to the runtime table in
      [CONTRIBUTING.md](../../../CONTRIBUTING.md).
- [ ] Document every engine divergence the run finds next to the code it
      constrains, starting with the two in [Findings](#findings).

### Out of scope

- A SpiderMonkey effects runner, until the simple script proves insufficient.
- Making SpiderMonkey a supported runtime for the `fjs` CLI as a whole.
- The impure `.mjs` proofs, and integration tests that need real IO (`http`,
  `childProcess`, filesystem writes).
- Registration with an external test framework (`register` in
  `../module.f.mjs`): the shell has no framework to register with.
- Coverage.

### Related

- [browser-testing](browser-testing.md) — another host that runs only
  authored proofs; its scope rule is the one this runner selects by.
- [stack-safety](../../edag/todo/stack-safety.md) — the thousand-level vector
  is a stack margin there too, and the shell's smaller call depth shrinks it.
- [node-module-layering](../../effects/todo/node-module-layering.md) — lowering
  the runtime-agnostic operations out of `fjs/effects/node` is what lets a
  non-Node runner implement a subset without depending on the Node module.
- [run a subset of proofs](run-subset-of-tests.md) — the runner's
  subdirectory argument is the coarse version of selection.
