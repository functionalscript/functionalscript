## Run coverage over FunctionalScript files only

**Priority:** P3
**Status:** open

### Problem

`npm run cov` runs every proof `shouldLoad` in
[`fjs/dev`](../../dev/module.f.mjs) accepts and then measures
`module.f.mjs` and `module.f.js`. The proofs include the plain JavaScript
ones — every file whose name ends in `proof.mjs`, under `fjs/` and `spec/`
alike, since `npm run cov` from the root walks the whole tree;
`fjs/effects/node/proof.mjs` and `fjs/compiler/transpiler/proof.mjs` among
them, and proofs under `spec/` reaching measured modules through
`fjs/compiler/refused_demo/host.mjs` — so a line of a
FunctionalScript module may be covered by a JavaScript proof alone. The
coverage verdict is then a function of JavaScript files as well as
FunctionalScript ones, and a change to a `proof.mjs` can move it.

The [build cache](../../ci/cache/README.md) therefore keys coverage on the
`js` group. After this task it may use `fjs`, provided every plain JavaScript
module a FunctionalScript proof imports is included too. The host adapters
under `fjs/effects/` and the runner and reporter under `fjs/emergent_testing/`
already belong to `fjs`; other dependencies need the same audit before moving
the key. `deno task cov` has the same shape: every test, `module.f.m?js` measured.

### Proposal

Under coverage, load FunctionalScript proofs from `.f.mjs` and `.f.js` files
only. `isAuthored` in `fjs/dev` already selects those files. The Node coverage
run uses the FJS-only native entry from
[the implemented runner split](../README.md#selecting-fjs-or-host-js-with-a-native-runner), in place of the combined
entry that uses `shouldLoad`.

The [six-job CI plan](../../ci/todo/six-ci-jobs.md) requires coverage on Node
only. Bun and SpiderMonkey test FJS through the repository runner. Node,
Deno and Bun test host JavaScript through their native runners without
coverage, on each OS assigned by the plan. Adding Deno or Bun coverage to CI
is outside this task.

The measured set stays `module.f.mjs` and `module.f.js`. FunctionalScript
files under other names are loaded but not measured, by two routes. A
parser's fixtures, the `rtti` guide's examples, `testlib.f.js` and
`data.f.js` are discovered: `loadModuleMap` imports every file
`isAuthored` accepts and evaluates it before asking for a `proof` export,
so they run as modules under the switch as they do today. A `*.data.js`
file is not discovered, since `isAuthored` accepts `.f.mjs` and `.f.js`
alone; it is reached by import from the modules that use it, as
`fjs/js/runtime/gen.edag.data.js` is. Measuring any of them is a rule
change to decide separately, not a consequence of this one.

A module whose coverage drops when its JavaScript proofs stop counting has
a proof gap `fjs/AGENTS.md` §1.2 already names: its own proof does not reach
the line. Each such gap is closed in the module's `proof.f.mjs` before the
switch, module by module, as
[per-module coverage](./per-module-coverage.md) does for the gaps hidden by
other modules' proofs.

### Tasks

- [ ] Run Node coverage through the FJS-only native entry using `isAuthored`
      and list the modules whose coverage drops.
- [ ] Close each gap in the module's own `proof.f.mjs`.
- [ ] Make `npm run cov` select the FJS-only native entry and retain its
      coverage thresholds. The generated CI requires coverage under Node only.
- [ ] Keep host-JS proofs in the JS-only native entries for Node, Deno and Bun;
      the six-job migration removes the existing Deno/Bun coverage commands
      in favor of the assigned FJS and JS test runs.
- [ ] [`CONTRIBUTING.md`](../../../CONTRIBUTING.md) says what coverage runs
      and measures, and the build cache's `fjs` rung cites it.

### Related

- [Selective runner entries](../README.md#selecting-fjs-or-host-js-with-a-native-runner)
- [Six CI jobs](../../ci/todo/six-ci-jobs.md)
- [Prove each module's coverage by its own proof](./per-module-coverage.md)
- [Cache successful builds by their inputs](../../ci/cache/README.md)

