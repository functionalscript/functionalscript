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
`await`, `env`, and an exit code. The only runner that backs them with real
host IO is `../../effects/node/module.mjs`, which imports `node:fs`,
`node:http`, `node:process`, and `node:test` at the top of the file. There is a
second interpreter, `../../effects/node/virtual/module.f.mjs`, and it is
`node:`-free — but it answers `readdir` and `import` from simulated state, so
it cannot discover the real tree, which is what discovery needs. The
SpiderMonkey shell (`js`) has none of the Node APIs: no `node:` namespace, no
package resolution, and no directory listing to build the module map from.
Loading that runner in the shell fails before any proof is reached.

### Proposal

**Take the simplest thing that runs proofs on SpiderMonkey, and keep taking it.**
Everything below is the simplest path found so far, not a design to defend: if
the shell can run the suite with less machinery — a flag, a loader hook, a
`js` invocation that needs no generated file at all — that is the solution, and
this issue should shrink to it. Nothing here is worth building for its own
sake.

The simplest path found so far is two steps.

1. **Generate one file, on Node.** Walk the tree with the discovery half of
   `loadModuleMap` (`../../dev/module.f.mjs`, `shouldLoad`) and write a single
   `.mjs` file that *statically* imports every **accepted** module exporting
   `proof`, followed by a small runner: walk each `proof` value, call the
   zero-argument functions, `try`/`catch` around each call, count passes and
   failures, `print` the failures, and `quit(1)` if any.

   Three details are not optional, because the existing suite depends on each.

   **Accept a root only when its whole transitive relative graph is
   shell-loadable.** Discovery matches `proof.mjs` as well as `.f.mjs`, and
   `fjs/effects/node/memory/proof.mjs` reaches `node:crypto` through its
   `./module.mjs`. A static import graph is loaded in full before a line of the
   runner executes, so one such root does not fail its own tests — it aborts
   the run before any proof is reached. Inspect each root's transitive
   dependencies, reject the ones reaching a `node:` import or an external
   package, and *report* what was excluded; a silent omission is a suite that
   shrinks without saying so. This is the same acceptance rule
   [browser-testing](browser-testing.md) states, for the same reason.

   **Invert the `throw`-tagged calls.** FunctionalScript has no `try`/`catch`,
   so a test that a call throws is written by nesting it under a `throw` key
   ([fjs/AGENTS.md §1.5](../../AGENTS.md#15-never-use-trycatch-test-throwing-with-the-throw-key)),
   and `collectTests` carries that down as `throws`. The runner has to read the
   flag and invert: a throw is the pass and a clean return is the failure, as
   `defaultTest` (`../module.f.mjs`) does. A walker that only counts thrown
   errors as failures reports every expected throw in `fjs/asserts/proof.f.mjs`
   as broken, and passes a `throw` test that quietly stopped throwing — the
   more expensive half, since it reads as green.

   **Walk return values, not just the exported tree.** A test function may
   return a further sub-tree of test functions, and the suite uses it —
   `fjs/crypto/sha2/proof.f.mjs` returns its `s256` and `s224` cases from
   `base.b32`. A walker that calls the outer function and stops counts one pass
   and silently skips the assertions inside. Recurse into each non-`throw`
   call's return value, with `null` marking the call boundary so paths render
   as `outer().inner`, as `runModule` and `registerModule` (`../module.f.mjs`)
   already do — `collectTests` itself only walks the static tree and calls
   nothing; those two hand it each `[...path, null]` after a call returns.
   Import `collectTests` rather than reimplementing it. Its chain is clean, and
   the extension is why: `../effects/node/module.f.mjs` *declares* the
   operations as data, while the `node:` imports live in its sibling
   `module.mjs`, the runner, which nothing on this path reaches — no `node:`
   and no bare package specifier appears anywhere in that closure. Run the
   acceptance check above over the generated file's own imports too, so that stays
   something the generator verifies rather than something this issue
   remembers.

2. **Run it:** `js --module <out>/spidermonkey.mjs` — with whatever flags the
   pinned build needs.

**Nix is how the shell gets installed.** The repository already pins a Nixpkgs
commit (`../../ci/config/module.f.mjs`) and generates one flake per job
(`../../ci/nix/module.f.mjs`, [nix/README.md](../../../nix/README.md)), so a
`spidermonkey` job declared there gives the same shell binary locally and in
CI, at a version the pin decides:

```sh
nix develop ./nix/generated/spidermonkey --command js --version
```

Both halves of that line are read off the pinned commit rather than assumed.
The attribute is versioned — `spidermonkey_115`, `spidermonkey_128`, and
`spidermonkey_140` are what Nixpkgs carries at `f4f6986`
(`pkgs/top-level/all-packages.nix:4966-4968`) — while the binary needs no
guessing at all: the package's `preFixup`
(`pkgs/development/interpreters/spidermonkey/common.nix:174-178`)
unconditionally symlinks `$out/bin/js` to `js<major>`, so plain `js` and
`js140` both land on `PATH` and every `js …` command in this issue works as
written. The job needs Node in its `packages` too, since the generator step
runs there. A `jsshell` download or jsvu's `sm` is a fine way to try this by
hand first; Nix is what the committed setup should use.

That is the whole first version. It deliberately does **not** port the effects
layer: no `Effect` runner, no `ModuleMap`, no `sandbox`/`write`/`await`/`env`
operations, no `Reporter`. `runModuleMap` and the operations behind it are the
Node runner's business, and reaching for them means writing a second host
runner (a sibling of `../../effects/node/module.mjs` with no `node:` imports)
before knowing whether a `print`-and-`quit` script would have done. Do that
only when something concrete demands it — the shared reporter output, or
proofs that return promises needing the job queue — and only for the operations
that demand it.

The Node side is the escape hatch for everything the shell lacks: module
resolution, listing a directory, reading a fixture. Prepare it on Node and bake
it into the generated file rather than asking the shell for it at run time. If
the shell's module loader will not resolve the generated file's relative
imports, emit one flat script instead of a module graph — a change to the
generator, not to the design.

The shell's exact API surface is the first unknown to close, and it is
version-dependent — `print`, `putstr`, `quit`, `scriptArgs`, `os.getenv`,
`read`/`snarf`, `drainJobQueue`, `--module`, `--module-load-path`, and dynamic
`import` all need checking against the build we pin rather than assumed.

### Tasks

- [ ] Declare a `spidermonkey` `NixJob` pinning the shell and Node from the
      existing Nixpkgs commit, in a module that owns it the way
      `nodeNixJobs` (`../../ci/node/module.f.mjs`) owns the Node ones, and add
      it to `nixJobs` in `../../ci/module.f.mjs` — `nixFlakes` writes the
      collection it is handed, so a job absent from that list generates no
      flake. `pkgs.spidermonkey_140` is the newest attribute the pinned commit
      offers; confirm the version the built shell reports.
- [ ] Check what that shell provides — output, exit code, args, environment,
      job queue, module loading. Note anything that makes the generated file
      unnecessary.
- [ ] Add the Node-side generator: static imports of every accepted proof
      module plus the inline runner, written to one file. Reject roots whose
      transitive graph reaches `node:` or an external package, and report the
      exclusions.
- [ ] Run it under `js`, get a nonzero exit code from a failing proof, and wire
      the generate-and-run pair to an `fjs` command.
- [ ] Fixtures: a passing proof, a failing proof, a `throw`-tagged proof in
      both directions (throwing passes, returning normally fails), a proof
      whose test returns a sub-tree, and a root reaching `node:` that must be
      excluded rather than emitted — each verified to run in the shell,
      not just to generate. Add a promise-returning proof once it is known
      whether the shell needs the job queue drained.
- [ ] Add a CI job (`../../ci/`) only after proof bodies demonstrably execute
      in the shell, and add the row to the runtime table in
      [CONTRIBUTING.md](../../../CONTRIBUTING.md).
- [ ] Document every engine divergence the run finds, next to the code it
      constrains.

### Out of scope

A SpiderMonkey effects runner, until the simple script proves insufficient;
making SpiderMonkey a supported runtime for the `fjs` CLI as a whole;
integration tests that need real IO (`http`, `childProcess`, filesystem
writes); registration with an external test framework (`register` in
`../module.f.mjs` — the shell has no framework to register with); coverage.

### Related

- [browser-testing](browser-testing.md) — the same "generate an entry module
  that statically imports every proof" shape for a host that cannot discover
  modules itself; share the generator if both land.
- [node-module-layering](../../effects/todo/node-module-layering.md) — lowering
  the runtime-agnostic operations out of `fjs/effects/node` is what lets a
  non-Node runner implement a subset without depending on the Node module.
- [run a subset of proofs](run-subset-of-tests.md) — selection would let the
  generated entry cover part of the tree.
