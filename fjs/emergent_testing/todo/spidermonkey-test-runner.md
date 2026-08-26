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
`await`, `env`, and an exit code. The only runner for those operations is
`../../effects/node/module.mjs`, which imports `node:fs`, `node:http`,
`node:process`, and `node:test` at the top of the file. The SpiderMonkey shell
(`js`) has none of them: no `node:` namespace, no package resolution, and no
directory listing to build the module map from. Loading that runner in the
shell fails before any proof is reached.

### Proposal

Split the work at the line the shell draws: everything that needs the
filesystem happens on Node, ahead of time, and the shell receives a
self-contained program.

1. **Preparation, on Node.** A new command generates the entry point rather
   than discovering modules at run time. It reuses the discovery half of
   `loadModuleMap` (`../../dev/module.f.mjs`) to find every module matching
   `shouldLoad`, and writes an entry module that *statically* imports each one
   and exports the same `ModuleMap` shape `runModuleMap` already consumes —
   relative path to module namespace. No `readdir` and no `import` operation
   survives into the shell.

2. **A SpiderMonkey host runner.** A sibling of `../../effects/node/module.mjs`
   with no `node:` imports, implementing only the operations the built-in
   runner reaches: `write` (`putstr` / `print`), `sandbox` (`try`/`catch`, as
   the Node runner does — the host runner is plain JavaScript, not
   FunctionalScript), `await` (the shell's job queue), `env` (`os.getenv`), and
   the process exit code (`quit`). Everything else answers `notImplemented`,
   which is what that channel is for.

3. **Invocation.** `js --module <out>/entry.mjs`, with the flags the pinned
   build needs, exiting nonzero when a proof fails.

The Node wrapper is also the general escape hatch: anything the shell turns out
to lack — module resolution, reading a fixture, listing a directory — is
prepared on Node and baked into the generated program instead of being asked of
the shell at run time. If the shell's module loader cannot resolve the relative
imports of the generated entry, the same step emits one classic script instead
of a module graph; that is a change to the generator, not to the design.

The shell's exact API surface is the first unknown to close, and it is
version-dependent — `print`, `putstr`, `quit`, `scriptArgs`, `os.getenv`,
`read`/`snarf`, `drainJobQueue`, `--module`, `--module-load-path`, and dynamic
`import` all need checking against the build we pin rather than assumed.

### Tasks

- [ ] Pin a SpiderMonkey build and record, in a README beside the runner, which
      shell functions and flags it actually provides — output, exit, args,
      environment, job queue, module loading.
- [ ] Add the SpiderMonkey host runner: `write`, `sandbox`, `await`, `env`,
      exit code; no `node:` imports; `notImplemented` for the rest.
- [ ] Add the Node-side generator that discovers proof modules and writes an
      entry module exporting a static `ModuleMap`.
- [ ] Wire it to an `fjs` command and make a failing proof produce a nonzero
      exit code.
- [ ] Fixtures: a passing proof, a failing proof, a `throw`-tagged proof, and a
      proof returning a promise — each verified to run in the shell, not just
      to generate.
- [ ] Add a CI job (`../../ci/`) only after proof bodies demonstrably execute
      in the shell, and add the row to the runtime table in
      [CONTRIBUTING.md](../../../CONTRIBUTING.md).
- [ ] Document every engine divergence the run finds, next to the code it
      constrains.

### Out of scope

Making SpiderMonkey a supported runtime for the `fjs` CLI as a whole;
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
