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

Under coverage, load FunctionalScript proofs only: `proof.f.mjs`, and the
`proof` export of a `module.f.mjs`. `isAuthored` in `fjs/dev` is already
that predicate — it is what every engine but Node, Deno and Bun loads — so
the coverage run takes it in place of `shouldLoad`, on every engine. The
plain JavaScript proofs keep running in the suite, without coverage, where
the `js` rung of the cache reruns them.

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

- [ ] Run `npm run cov` with `isAuthored` in place of `shouldLoad` once and
      list the modules whose coverage drops.
- [ ] Close each gap in the module's own `proof.f.mjs`.
- [ ] `npm run cov` and `deno task cov` load FunctionalScript proofs only,
      and `bun test --coverage` the same; the generated CI runs them so.
      The Deno and Bun jobs run only their coverage command today, so each
      gains a plain run beside it — `deno task test`, `bun test` — or the
      plain JavaScript proofs stop running on those engines.
- [ ] [`CONTRIBUTING.md`](../../../CONTRIBUTING.md) says what coverage runs
      and measures, and the build cache's `fjs` rung cites it.

### Related

- [Prove each module's coverage by its own proof](./per-module-coverage.md)
- [Cache successful builds by their inputs](../../ci/cache/README.md)
