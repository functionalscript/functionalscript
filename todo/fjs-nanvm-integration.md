## fjs–nanvm integration

**Priority:** P1
**Status:** open

### Problem

The MVP ([mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md)) is reached when
`fjs compile` can emit Rust code that calls the `nanvm-lib` API, and a
harness crate builds and runs the generated code with cargo. It is reached:
the [named-module acceptance](#named-module-acceptance) example runs through
the harness's `run`, in a `cargo test` that builds and runs the generated code
with cargo. The one task still open below, the repository migration, does not
gate it, and neither did `.f.js` package support, complete since: the walking
skeleton needs no repository source migration
([below](#repository-compiler-compatibility-migration)). This
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
exports and aliases from dependency export objects, and the consumer does the
same: `nanvm-harness::run(module, export, action)` reads or calls one named
export and renders that one result as JSON
([`nanvm-harness/src/lib.rs`](../nanvm-harness/src/lib.rs)). Neither feature
requires named function parameters.

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
compiles this pattern to Rust. Its cargo test has the harness's `run` select
`main` and call it with no arguments, and checks `42`, matching native
JavaScript and both JavaScript EDAG evaluators (`namedImports.acceptance` in
[`fjs/compiler/edag/proof.f.mjs`](../fjs/compiler/edag/proof.f.mjs), on its own copy of
the sources). The harness has no CLI; its
[`main`](../nanvm-harness/src/main.rs) says why. Source round trips cover the
serializer's admitted expressions; calls and arithmetic are still refused by
that serializer. `main` is the fixture's selected
export, not a required language-level name. The rest-only helper keeps this
milestone independent of named function parameters. These are synthetic
fixtures; renaming repository modules to `.f.js` is the migration below.

### Repository compiler-compatibility migration

**Blocked by:** nothing. Package support for authored `.f.js` is complete,
the packed-package check closing the `node26` CI job importing a published
`.f.js` from a clean consumer
([`fjs/ci/package/module.f.mjs`](../fjs/ci/package/module.f.mjs)).

Stage 1 — removing authored TypeScript — is complete and is no longer a
blocker. It was tracked in `todo/migrate-typescript-to-mjs.md`, deleted once
finished; the extension contract it established lives in
[`fjs/compiler/README.md`](../fjs/compiler/README.md), which also records what stage 1
removed along the way — the TypeScript-to-JavaScript emit path
([#1520](https://github.com/functionalscript/functionalscript/pull/1520)) and
the blanket `**/*.js` ignore
([#1545](https://github.com/functionalscript/functionalscript/pull/1545)).
`.f.mjs` means authored FunctionalScript-intent JavaScript; it does not
promise current compiler support.

Before stage 2 renamed any repository source, the focused package-support
prerequisite had to hold: a standalone authored `.f.js` directly included in
TypeScript checking, given a generated `.d.ts`, included in the packed NPM
artifact, and working from a clean consumer. Stage-2 package and publish
validation runs from a clean CI checkout, so generated-output cleanup or
repeated-pack safety is not part of it. Compiler acceptance alone was not a
sufficient rename gate.

**Decided, then: rename before the prerequisite's last task; done since.** A synthetic
fixture proved type-checking, declaration emission, packing and coverage on
`main`; what the prerequisite still lacked was `package-check` importing a
`.f.js` from a consumer with a negative control, a check of the package job
rather than of any renamed module. Meanwhile `fjs compile` with no arguments
held every `.f.js` to the compiler of its revision, in CI, which is the
guarantee the gate existed to protect. So the first renames landed on that
check, and the consumer check followed at once, against a real renamed module
rather than the fixture, which is retired.

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

See [`fjs/compiler/README.md`](../fjs/compiler/README.md) for the authoritative extension
contract and migration strategy.

#### What the next rename waits on

Measured at `4c8ec55`, the head of `main`: every `.f.mjs` that imports no
other `.f.mjs` is a *leaf*, the only module a rename can start from, and
`fjs compile` was run on each. The compiler stops at its first refusal, so one
refusal per row is the compiler's and the rest of the row is a reading of the
module, each item confirmed against the compiler with a one-line module.
"Behind it" counts the non-proof `.f.mjs` and `.f.js` modules that import the
leaf, directly or not — what a leaf's rename opens up, since a proof stays
`proof.f.mjs` whatever its module is named
([`fjs/compiler/README.md`](../fjs/compiler/README.md)).

| Leaf | Behind it | The compiler refuses |
| --- | ---: | --- |
| `fjs/types/object/structurally_same` | 227 | destructuring (`const { entries, is } = Object`, `([k, v]) =>`), the `Object` global, `instanceof`, `new Map`, a runtime key `b[i]` |
| `fjs/types/function` | 219 | `let`, reassignment and `while`, all inside `iterate` |
| `fjs/types/function/operator` | 216 | template literals, destructured `const`s and parameters, runtime keys `steps[i]` and `prior[i]` |
| `fjs/types/result` | 148 | `for … of` in `okList`, destructured parameters |
| `fjs/js/array_index` | 55 | the `Number` and `String` globals |
| `fjs/js/keywords` | 30 | `new Set` |
| `fjs/types/set` | 29 | `let`, reassignment, `+=`, `while` with `break`, `new Set`, a runtime key `set[i]` |
| `fjs/types/map` | 25 | `new Map`, a destructured parameter |
| `fjs/website/demo/examples` | 22 | `new Set`, destructured parameters |
| `fjs/ci/package` | 6 | template literals, the `JSON` global |
| `fjs/git/bytes` | 5 | a runtime key `b[at]`, `Number.isSafeInteger` |
| `fjs/website/demo/code` | 5 | template literals, a `'\0'` escape |
| `fjs/website/style` | 5 | template literals, and nothing else |
| `fjs/nanvm/member` | 3 | `\u{…}` escapes, template literals |
| `fjs/types/ts` | 2 | template literals, destructured parameters, `switch`, a default parameter, the `JSON`, `isFinite` and `String` globals |
| `fjs/git/config` | 1 | `\v` and `\0` escapes, destructuring, runtime keys `escapes[c]` and `prefixes[…]`, `toLowerCase` (a prohibited member function), template literals |
| `fjs/nanvm/methods` | 1 | template literals, destructuring, the `Object` global, a runtime key `p[type]` |
| `fjs/website/browser-source` | 1 | `let`, `+=`, `while` with `break` and `continue`, a non-terminating `if`, runtime keys, template literals |

Since the previous measurement, at `89a12ea` with `main` at `4c67d6f`, the
leaves are the same eighteen and the compiler has moved on two of them:
`\f` is JSON's escape and compiles, so `git/config` no longer waits on it,
and `git/config`'s every `if` terminates, so the non-terminating `if` holds
`browser-source` alone. Three readings also changed: `ci/package`'s
`new Error` is text inside a template literal, not code; `nanvm/member`
destructures nothing; and optional chaining, `?.`, which two leaves use, was
not read before — and has landed since
([optional chaining](../spec/README.md#optional-chaining)), so neither row
names it.

The same rows by feature, each with where the feature is tracked, so a
language step can be picked for what it unblocks:

| Feature | Tracked in | Leaves it holds |
| --- | --- | --- |
| Template literals | [`spec/todo/3440-template-literals.md`](../spec/todo/3440-template-literals.md) | function/operator, ci/package, ts, nanvm/methods, nanvm/member, style, demo/code, git/config, browser-source |
| Destructuring | [`spec/todo/2450-destructuring.md`](../spec/todo/2450-destructuring.md) | structurally_same, result, function/operator, map, demo/examples, ts, git/config, nanvm/methods |
| A runtime key, `a[i]` | an index the program knows to be a number is `a[Number(i)]`, [in the language](../spec/README.md#property-access); a key of any type waits on the `entry` helper | structurally_same, function/operator, set, git/bytes, git/config, nanvm/methods, browser-source |
| Globals and built-ins | [`spec/todo/2365-global-names.md`](../spec/todo/2365-global-names.md), [`2360-built-in.md`](../spec/todo/2360-built-in.md) | structurally_same, array_index, ts, git/bytes, nanvm/methods, ci/package |
| `new` with a built-in constructor | nothing proposes it | structurally_same, keywords, map, set, demo/examples |
| `let`, reassignment, `while` | [`spec/todo/3220-let.md`](../spec/todo/3220-let.md); `while` is roadmap §3.2 | function, set, browser-source |
| String escapes `\u{…}`, `\v`, `\0` | [`spec/todo/2460-js-string-literals.md`](../spec/todo/2460-js-string-literals.md) | nanvm/member, demo/code, git/config |
| A non-terminating `if`, `break`, `continue` | roadmap §3.2, the guard's follow-ups; `break` and `continue` are `while`'s | set, browser-source |
| `for … of` | nothing proposes it | result |
| `instanceof` | nothing proposes it | structurally_same |
| `switch`, a default parameter | neither proposed; the parameter is roadmap §3.1 | ts |
| A prohibited member function, `toLowerCase` | [`fjs/js/prototype`](../fjs/js/prototype/module.f.js)'s `prohibitedCalls`; the module rewrites, not the language | git/config |

A leaf renames only when every feature it uses has landed, and three wait on
one feature alone: `style` on template literals, `array_index` on the
`Number` and `String` globals, `keywords` on `new Set`. Of the four root
modules nearly everything imports, `structurally_same` waits on five
features, and `function/operator` on three. `iterate` in `function` could
lose its loop today, which would leave that module on nothing — `let`,
reassignment and `while` are all inside `iterate`, and the shorthand `fn`
returns, `{ result, map }`, is in the language
([objects](../spec/README.md#objects)) — the one rename no language step
gates. `okList` in `result` could lose its `for … of` the same way, but
`unwrap` and `invert` take destructured parameters, so that root waits on
destructuring either way. Template literals hold nine leaves and
destructuring eight, more than any other feature.

#### The whole repository

The same loop over every authored module, not only the leaves, measured at
the same `4c8ec55`: of 228 modules — 222 `module.f.mjs` and 6 `module.f.js`
— the 6 `.f.js` compile and every `.f.mjs` stops at its first refusal. The
table counts that first refusal only, read at the token the compiler names,
so it says which feature to settle first, not how much each costs; a refusal
the compiler meets in an import is counted under the import's feature, 17 of
the rows' members.

| Modules | First refusal |
| ---: | --- |
| 94 | a template literal |
| 47 | destructuring, a `const` or a parameter |
| 23 | `let`, `for`, `switch`, or an `if` with no block |
| 13 | a computed member or key, `a[i]`, `{ [k]: v }` |
| 10 | an escape in a single-quoted string, `'\x07'`, `'\0'` |
| 9 | a call as a statement, `assert(…)` |
| 8 | `const not found`: three reads of a later `const` ([`3140`](../spec/todo/3140-forward-references.md)), five of `Number` or `Boolean` ([`2365`](../spec/todo/2365-global-names.md)) |
| 5 | `new Set`, `new Map` |
| 5 | `instanceof` |
| 5 | `export { … }`, with and without `from` |
| 3 | one each: a reassignment, `in`, a default parameter |

The count at `8f78921`, with `main` at `0882d09` merged in, was the same
table over 227 modules with 93 template literals: one module was added and
nothing else moved.

Template literals are the first refusal of two modules in five, almost all
of them error messages and `assert` texts, and they are a feature with open
questions of its own
([`3440`](../spec/todo/3440-template-literals.md)) — the case for settling
those questions, not a license to start before they are. Destructuring is
next, and the string-escape row is tokenizer work. The leaf table above is
what this count does not say: a module whose
first refusal clears meets its next, and only a leaf whose every feature has
landed renames.

The count of modules that compile cannot go down unnoticed: a module renames
to `.f.js` once the compiler accepts it, and `fjs compile` with no arguments
holds every `.f.js` to the compiler of its revision on every CI run, so the
`.f.js` population is the tracked set. Both tables are reread when a feature
they name lands. The loop that reproduces the count, an empty second field
being a module that compiled:

```sh
for f in $(find fjs -name module.f.mjs -o -name module.f.js | sort); do
  echo "$f|$(node fjs/module.mjs compile "$f" out.rs 2>&1 | head -1)"
done
```

### CLI: an output target, not a command group (decided)

`fjs compile <input> <output>` already dispatches on the output extension
(`.json` vs. DJS — see [`fjs/compiler/module.f.mjs`](../fjs/compiler/module.f.mjs)). Rust
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
via the FJS interpreter compiled to Rust ahead of time — no rustc at the user's
run time. Its [module loader](../fjs/compiler/todo/load-modules-without-import-effect.md)
needs no native `import` effect. The optional [Rust EDAG library](./rust-edag.md)
is on hold and is not part of this completed MVP or a self-hosting prerequisite.

### Tasks

- [x] Add the `.rs` branch to `fjs compile`: a generated Rust **module**
      exposing the complete export object (e.g.
      `pub fn module<A: IVm>() -> Result<Any<A>, Any<A>>`), not a `main`.
      The original literal/container walking skeleton has grown to include
      operators, calls and capturing functions; current coverage lives in
      the [parser](../fjs/compiler/parser/README.md),
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
      evaluators, and generated Rust, the Rust first through explicit VM
      selection/call operations and now through the harness's `run`.
- [x] Implement harness export selection: `run(module, export, action)`
      reads or calls one named export, and the named-module example runs
      through it. The selection is exposed as the harness API only; a CLI
      waits for a use ([`main.rs`](../nanvm-harness/src/main.rs)).
- [x] Inline source dependencies into one generated Rust output.
      `rustText` in the [compiler](../fjs/compiler/module.f.mjs) resolves the complete
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
- [x] Complete package support for authored `.f.js`, including direct
      type-checking, declaration emission, packing, and clean-consumer
      runtime/type tests — the packed-package check imports
      `fjs/js/prototype/module.f.js` from a clean consumer, runs it, and
      type-checks a use of `PrototypeName` with a negative control
      ([`fjs/ci/package/module.f.mjs`](../fjs/ci/package/module.f.mjs)).
- [x] Verify `.js` is trackable and authored `.f.js` is a first-class package
      source before the first compiler-compatibility rename — proved first on
      a synthetic package fixture, tracked, type-checked, declared, packed
      and covered, and retired once the real modules below took its place.
- [x] Convert the first eligible dependency-closed repository modules from
      `.f.mjs` to `.f.js`: every module the compiler accepted whole —
      `fjs/ci/config`, `fjs/js/prototype`, `fjs/nanvm/constructors`,
      `fjs/types/btree/types`, `fjs/types/range`, the compiler's two example
      modules and the six `spec/datajs/vectors/*/data.f.js` — with
      `fjs compile` checking each on every CI run, and no `.f.js` importing an
      `.f.mjs`.
- [x] Rename `fjs/compiler/examples`, the one leaf the compiler accepted whole
      after `!` and `typeof`: its eleven importers, proofs and demos, follow it.
- [ ] Continue `.f.mjs` -> `.f.js` incrementally as compiler support grows.

### Related

- [`fjs/ci/package/module.f.mjs`](../fjs/ci/package/module.f.mjs) — the
  packed-package check closing the `node26` CI job, the clean-consumer check
  of a published `.f.js`.
- [`fjs/compiler/README.md`](../fjs/compiler/README.md) — the extension contract, and the
  stage-1/stage-2 boundary this migration starts from.
- [nanvm-lib/todo/mvp-roadmap.md](../nanvm-lib/todo/mvp-roadmap.md) — the
  design decided around the MVP pipeline and the post-MVP tasks; this file
  holds the MVP definition and its tasks.
- [nanvm-lib/todo/console-program.md](../nanvm-lib/todo/console-program.md) —
  the self-hosted `nanvm` crate (post-MVP).
- [authored `.mjs` package support](../fjs/ci/todo/f-mjs-package-support.md) —
  stage-1 validation, declaration, and package prerequisite.
- [`publishing-packages.md`](../fjs/ci/todo/publishing-packages.md) — broader
  package-publishing roadmap.
- [`fjs/edag`](../fjs/edag/README.md) — the schema of the code-describing
  `Any`, shared by the compiler and FJS interpreter.
