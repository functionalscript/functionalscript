## Run coverage over FunctionalScript files only

**Priority:** P3
**Status:** open

### Problem

`npm run cov` runs every proof `shouldLoad` in
[`fjs/dev`](../../dev/module.f.mjs) accepts and then measures
`module.f.mjs` and `module.f.js`. The proofs include the plain JavaScript
ones — nineteen `proof.mjs` files, `fjs/effects/node/proof.mjs` and
`fjs/compiler/transpiler/proof.mjs` among them — so a line of a
FunctionalScript module may be covered by a JavaScript proof alone. The
coverage verdict is then a function of JavaScript files as well as
FunctionalScript ones, and a change to a `proof.mjs` can move it.

The [build cache](../../ci/todo/097-smart-ca-ci.md) keys coverage on the
`fjs` group — `*.f.mjs`, `*.f.js`, `*.data.js`, with `package.json` and
the runner and reporter under `fjs/emergent_testing` listed beside them —
and skips it when only JavaScript or TypeScript changed. The plain
JavaScript proofs are the one input of the coverage verdict that key does
not see and this task removes. What it does not remove: a plain
JavaScript module a FunctionalScript proof imports — a host adapter such
as `fjs/effects/node/module.mjs` — still executes under coverage and is
`js`, so a change to one can move a line's coverage without moving the
`fjs` key. That residual is the cache plan's, closed by its dependency
graph step, and is named there. `deno task cov` has the same shape: every
test, `module.f.m?js` measured.

### Proposal

Under coverage, load FunctionalScript proofs only: `proof.f.mjs`, and the
`proof` export of a `module.f.mjs`. `isAuthored` in `fjs/dev` is already
that predicate — it is what every engine but Node, Deno and Bun loads — so
the coverage run takes it in place of `shouldLoad`, on every engine. The
plain JavaScript proofs keep running in the suite, without coverage, where
the `js` rung of the cache reruns them.

The measured set stays `module.f.mjs` and `module.f.js`. FunctionalScript
files under other names — a parser's fixtures, the `rtti` guide's examples,
`testlib.f.js`, `data.f.js`, `*.data.js` — are loaded but not measured:
`loadModuleMap` imports every file `isAuthored` accepts and evaluates it
before asking for a `proof` export, so they run as modules under the
switch as they do today, and the proofs that use them import them as data
or parse them as text besides. Measuring them is a rule change to decide
separately, not a consequence of this one.

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
- [ ] [`CONTRIBUTING.md`](../../../CONTRIBUTING.md) says what coverage runs
      and measures, and the build cache's `fjs` rung cites it.

### Related

- [Prove each module's coverage by its own proof](./per-module-coverage.md)
- [Cache successful builds by their inputs](../../ci/todo/097-smart-ca-ci.md)
