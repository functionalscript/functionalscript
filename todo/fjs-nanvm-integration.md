## fjs–nanvm integration

**Priority:** P1
**Status:** open

### Problem

The MVP ([mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md)) is reached when
`fjs compile` can emit Rust code that calls the `nanvm-lib` API, and a
harness crate builds and runs the generated code with cargo. This
integration does **not** need to wait for everything else: it can start as
soon as a minimal subset works end-to-end (e.g. a module whose default
export is a constant), before the operators, the full parser, and the rest
of the P1 tasks are complete.

Integrating first means every later feature (operators, functions, control)
lands into an already-working pipeline and is verified end-to-end from day
one, instead of a big-bang integration at the end.

The EDAG module computation and generated Rust return the complete export
object, as the [module contract](../spec/README.md#exporting-a-value) already
requires on `main`. For example, `export const answer = 42; export default 7;`
returns `{ answer: 42, default: 7 }`. Without `export default`, there is no
`default` property. Module evaluation creates exported functions; invoking
one is a separate consumer operation.

Source dependencies are already linked into one EDAG before Rust generation.
Each `fjs compile <input> <output>.rs` invocation writes one Rust file containing
that complete graph, following the
[import-inlining contract](../spec/README.md#importing-other-modules).
There is no pending convention for Rust imports between source dependencies.
The embedding crate chooses where to include the generated file.

[Named imports](../spec/README.md#importing-other-modules) now select named
exports and aliases from dependency export objects. The remaining consumer gap
is [harness export selection](../nanvm-harness/todo/select-module-export.md):
`nanvm-harness::run` still selects `default` and serializes it without invoking
a function. Neither feature requires named function parameters.

### Named-module acceptance

Implemented compiler acceptance input:

```js
// math.f.js
export const add = (...args) => args[0] + args[1];
```

```js
// app.f.js
import { add as sum } from "./math.f.js";
export const main = () => sum(20, 22);
```

The [named-imports fixture](../nanvm-harness/fixtures/named-imports.mjs)
compiles this pattern to Rust. Its cargo test selects `main` through the VM API,
invokes it with no arguments, and checks `42`, matching native JavaScript and
both JavaScript EDAG evaluators. A general harness selection/call API and CLI
remain the separate export-selection task. Source round trips cover the
serializer's admitted expressions; calls and arithmetic are still refused by
that serializer. `main` is the fixture's selected
export, not a required language-level name. The rest-only helper keeps this
milestone independent of named function parameters. These are synthetic
fixtures; renaming repository modules to `.f.js` retains its separate package
prerequisite below.

### Repository compiler-compatibility migration

**Blocked by:**

- [package support for authored `.f.js`](../fjs/ci/todo/f-js-package-support.md)

Stage 1 — removing authored TypeScript — is complete and is no longer a
blocker. It was tracked in `todo/migrate-typescript-to-mjs.md`, deleted once
finished; the extension contract it established lives in
[`fjs/fsc/README.md`](../fjs/fsc/README.md).

The initial compiler walking skeleton does not require repository source
migration and may use a small synthetic JavaScript fixture. The extension-based
compiler-compatibility migration of existing repository modules is separate and
cannot begin while authored TypeScript remains.

Stage 1 first converts the repository gradually and dependency-first:

```text
module.ts   -> module.mjs
module.f.ts -> module.f.mjs
```

During stage 1, `.f.mjs` means authored FunctionalScript-intent JavaScript; it
does not promise current compiler support. The stage also removes the
TypeScript-to-JavaScript emit path after the last TypeScript source is gone
(done in [#1520](https://github.com/functionalscript/functionalscript/pull/1520):
`prepack` emits declarations only, then re-checks against them without
emitting), cleans obsolete generated `.js`, and removes the
blanket `**/*.js` ignore so `.js` becomes authorable and trackable again (done
in [#1545](https://github.com/functionalscript/functionalscript/pull/1545); the
rule guarded only stale artifacts once nothing generated `.js`, and `**/*.js`
deliberately stays in `package.json`'s `files`).

Before stage 2 renames any repository source, complete the focused
[`f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md) prerequisite.
A standalone authored `.f.js` must be directly included in TypeScript checking,
receive a generated `.d.ts`, be included in the packed NPM artifact, and work
from a clean consumer. Stage-2 package and publish validation runs from a clean
CI checkout, so generated-output cleanup or repeated-pack safety is not part of
this prerequisite. Compiler acceptance alone is not a sufficient rename gate.

Only then does the repository compiler-compatibility migration use:

```text
module.f.mjs -> module.f.js
```

An authored `.f.js` must be accepted by the FunctionalScript parser and compiler
in the same repository revision. Migration remains incremental: select a
compiler-supported dependency-closed `.f.mjs` module or coherent group, rename
it to `.f.js`, update runtime and type references plus callers, and keep it as a
permanent end-to-end compiler regression input. Unsupported FunctionalScript
modules remain `.f.mjs` until the required compiler features land.

See [`fjs/fsc/README.md`](../fjs/fsc/README.md) for the authoritative extension
contract and migration strategy.

### CLI: an output target, not a command group (decided)

`fjs compile <input> <output>` already dispatches on the output extension
(`.json` vs. DJS — see [`fjs/fsc/module.f.mjs`](../fjs/fsc/module.f.mjs)). Rust
code generation is a third branch, selected by the `.rs` extension:

- `fjs compile <module> <output>.rs` — parse + compile into a generated Rust
  module that builds the module's value via the `nanvm-lib` API.

`fjs` never invokes cargo; building and running the generated code is an
ordinary cargo workflow in a Rust project (the harness in this repo, the
`nanvm` crate, or a user's own crate). The previously proposed
`fjs vm build` / `fjs vm run` command group is superseded by this: no new
CLI surface, and no Rust toolchain orchestration in the npm-shipped tool.
The ergonomic single command ("run my FJS on the VM") arrives as the
self-hosted `nanvm` crate
([console-program](../nanvm-lib/todo/console-program.md)), which interprets
via the `Function` constructor — no rustc at the user's run time.

### Tasks

- [x] Add the `.rs` branch to `fjs compile`: a generated Rust **module**
      exposing the complete export object (e.g.
      `pub fn module<A: IVm>() -> Result<Any<A>, Any<A>>`), not a `main`.
      The original literal/container walking skeleton has grown to include
      operators, calls and capturing functions; current coverage lives in
      the [parser](../fjs/fsc/parser/README.md),
      [shared Rust printer](../fjs/edag/rust/module.f.mjs) and
      [harness fixtures](../nanvm-harness/fixtures).
- [x] Create the harness: a crate (`nanvm-harness`) with a thin `main` that
      selects a generated module's `default` property and prints that value
      as JSON; wired into CI via `cargo test`. Exported functions are not
      invoked by this completed walking-skeleton step.
- [x] Preserve named and optional default properties in the module result
      through EDAG, Rust and source output. `export const` is already
      supported; do not file its implementation again.
- [x] Implement [named imports](../spec/README.md#importing-other-modules), selecting
      properties from dependency export objects without discarding the object
      or requiring a default export.
- [x] Prove the named-module compiler example in JavaScript, both EDAG
      evaluators, and generated Rust using explicit VM selection/call operations.
- [ ] Implement [harness export selection](../nanvm-harness/todo/select-module-export.md)
      and expose the same selection/call behavior through the harness API/CLI.
- [x] Inline source dependencies into one generated Rust output.
      `rustText` in the [compiler](../fjs/fsc/module.f.mjs) resolves the complete
      graph before calling `toRust`; source imports do not become separate
      Rust modules. The harness includes each generated fixture via `#[path]`
      as its own embedding choice.
- [x] Prove the pipeline with a minimal synthetic JavaScript FunctionalScript
      subset: a constant default export compiled by `fjs` to `.rs`, built and
      run by cargo, with the result printed to stdout as JSON —
      `nanvm-harness/fixtures/{number,boolean,string}.mjs` — then extended to
      arrays, objects, `const`-sharing, and string-keyed property access —
      `nanvm-harness/fixtures/{array,object,sharing,property}.mjs`, matched
      by [`Any::to_json`](../nanvm-lib/src/vm/any/to_json.rs) recursing into
      arrays/objects instead of refusing them.
- [ ] Complete
      [package support for authored `.f.js`](../fjs/ci/todo/f-js-package-support.md),
      including direct type-checking, declaration emission, packing, and
      clean-consumer runtime/type tests.
- [ ] Verify `.js` is trackable and authored `.f.js` is a first-class package
      source before the first compiler-compatibility rename.
- [ ] Convert the first eligible dependency-closed repository module or group
      from `.f.mjs` to `.f.js` and keep it in the end-to-end compiler, proof,
      coverage, type-checking, package-runtime, and package-type-resolution test
      sets.
- [ ] Continue `.f.mjs` -> `.f.js` incrementally as compiler support grows.

### Related

- [package support for authored `.f.js`](../fjs/ci/todo/f-js-package-support.md)
  — **blocked-by prerequisite** before the first stage-2 rename.
- [`fjs/fsc/README.md`](../fjs/fsc/README.md) — the extension contract, and the
  stage-1/stage-2 boundary this migration starts from.
- [nanvm-lib/todo/mvp-roadmap.md](../nanvm-lib/todo/mvp-roadmap.md) — MVP
  definition and task list.
- [nanvm-lib/todo/console-program.md](../nanvm-lib/todo/console-program.md) —
  the self-hosted `nanvm` crate (post-MVP).
- [authored `.mjs` package support](../fjs/ci/todo/f-mjs-package-support.md) —
  stage-1 validation, declaration, and package prerequisite.
- [`publishing-packages.md`](../fjs/ci/todo/publishing-packages.md) — broader
  package-publishing roadmap.
- [edag-spec](./edag-spec.md) — the schema of the code-describing `Any`; the
  `Function` constructor contract.
