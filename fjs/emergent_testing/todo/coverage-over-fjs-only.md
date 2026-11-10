## Run coverage over FunctionalScript files only

**Priority:** P3
**Status:** open

### Current state

`npm start cov node` runs each directory's own FunctionalScript proofs through
`one.mjs`, measuring `module.f.mjs`, `module.f.js` and `demo.f.mjs` with the
existing 100% thresholds. The former combined `npm run cov` script was removed.
The Deno and Bun CI jobs run the FJS-only native entry without coverage;
local `deno task cov` still offers combined-suite coverage.

Full-suite test cache keys deliberately retain the conservative `js` input
rung. Narrowing them to `fjs` requires auditing every host dependency imported
by an authored proof. Isolated coverage uses per-target dependency manifests.

### Proposal

Under coverage, load FunctionalScript proofs from `.f.mjs` and `.f.js` files
only. `isAuthored` in `fjs/dev` already selects those files. The Node coverage
run uses the shallow FJS-only native entry from
[the implemented runner split](../README.md#selecting-fjs-or-host-js-with-a-native-runner), in place of the combined
entry that uses `shouldLoad`.

The [six-job CI plan](../../ci/todo/six-ci-jobs.md) requires coverage on Node
only. Bun and SpiderMonkey test FJS through the repository runner. Node,
Deno and Bun test host JavaScript through their native runners without
coverage, on each OS assigned by the plan. Adding Deno or Bun coverage to CI
is outside this task.

The measured set is `module.f.mjs`, `module.f.js` and `demo.f.mjs`. FunctionalScript
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

The initial FJS-only run passed all 13,443 tests but exposed coverage gaps in
returned-tree failure reporting and member/operand return preparation. Authored
proofs now exercise those paths, including object/array spread snapshots and
active loop targets. Both modules meet 100% coverage in their scoped FJS-only
runs. CI reruns the complete gate on the final change.

### Tasks

- [x] Run Node coverage through the FJS-only native entry using `isAuthored`
      and list the modules whose coverage drops.
- [x] Close each gap in the module's own `proof.f.mjs`.
- [x] Make the former `npm run cov` select the FJS-only native entry and retain its
      coverage thresholds. The generated CI requires coverage under Node only.
- [ ] Keep host-JS proofs in the JS-only native entries for Node, Deno and Bun;
      the six-job migration removes the existing Deno/Bun coverage commands
      in favor of the assigned FJS and JS test runs.
- [x] [`CONTRIBUTING.md`](../../../CONTRIBUTING.md) says what coverage runs
      and measures, and the build cache's `fjs` rung cites it.

### Related

- [Selective runner entries](../README.md#selecting-fjs-or-host-js-with-a-native-runner)
- [Six CI jobs](../../ci/todo/six-ci-jobs.md)
- [Prove each module's coverage by its own proof](./per-module-coverage.md)
- [Cache successful builds by their inputs](../../ci/cache/README.md)

