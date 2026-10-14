## fjs–nanvm integration

**Priority:** P1
**Status:** wip

### Problem

The MVP ([mvp-roadmap](../nanvm/lib/todo/mvp-roadmap.md)) is reached when
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
([`nanvm/harness/src/lib.rs`](../nanvm/harness/src/lib.rs)). Neither feature
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

The [named-imports fixture](../nanvm/harness/fixtures/named-imports.mjs)
compiles this pattern to Rust. Its cargo test has the harness's `run` select
`main` and call it with no arguments, and checks `42`, matching native
JavaScript and both JavaScript EDAG evaluators (`namedImports.acceptance` in
[`fjs/compiler/edag/proof.f.mjs`](../fjs/compiler/edag/proof.f.mjs), on its own copy of
the sources). The harness has no CLI; its
[`main`](../nanvm/harness/src/main.rs) says why. The structural FJS serializer
already writes ordinary/method calls and arithmetic; `calls`, `neg`, `operators`
and `lazy` in the [serializer proofs](../fjs/compiler/serializer/proof.f.mjs)
cover grouping, bindings and supported source round trips. That profile remains
partial, unlike total code-only [function text](../fjs/edag/function-text.md);
[runtime-value compilation](../fjs/edag/values.md#runtime-compilation) has its own
behavioral contract. Deep source conversion chains retain their
[host-stack limit](../fjs/compiler/todo/deep-nesting-recursion.md#source-conversion-chains).
`main` is the fixture's selected
export, not a required language-level name. The rest-only helper keeps this
milestone independent of named function parameters. These are synthetic
fixtures; renaming repository modules to `.f.js` is the migration below.

JSON/DataJS compiler outputs now run represented module initialization,
including calls and arithmetic, before projecting the default export and
decoding it as data. Dependencies and unused initializers still run; an
unselected callable export does not prevent a data output, while a callable
remaining in the selected result is refused. See `callsAndOperators`,
`projectBeforeMaterializing` and `unusedInitialization` in the
[transpiler proofs](../fjs/compiler/transpiler/proof.f.mjs).
FunctionalScript, EDAG and Rust generation preserve the module computation
without running it during compilation.

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
modules remain `.f.mjs` until the required compiler features land. The
value-preserving rewrites a module takes on the way, one per construct, are
[`doc/CONVERTING.md`](../doc/CONVERTING.md).

See [`fjs/compiler/README.md`](../fjs/compiler/README.md) for the authoritative extension
contract and migration strategy.

#### Current leaf migration fixed point

Measured at `e40fa58`, the head of `main` after
[#2878](https://github.com/functionalscript/functionalscript/pull/2878)
admitted destructuring in parameters. A leaf is as defined in the `5dcd94b`
audit below, and the embedded-proof fixture is `example.f.js`, converted, so
there is none to report separately.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 12 | `website/prs/load` |
| 2 | 11 | `emergent_testing/node`, by two admitted rewrites |
| 3 | 10 | None: every remaining leaf is refused |

`website/prs/load` compiles whole: its four destructured parameters were
its only refusals, and the parameter pattern is admitted now. The conversion
changes the extension and its two importers, `website/prs-runtime.mjs` and
the proof; no `.f.mjs` imports the module, so its rename exposes no new
leaf. The authored `.f.js` population under `fjs/` grows from 32 to 33, and
`npm start compile` checks 39 with the specification's vectors.

Destructuring in parameters moves two more first refusals, and each lands
on a prohibited property name the earlier pattern had hidden.
`emergent_testing/node` passes its two destructured parameters and stops
at the read `data.name` in `log`: `name` is on
[`fjs/js/prototype`](../fjs/js/prototype/module.f.js)'s `prohibitedCalls`,
and a read of such a name is refused as its call is. `nanvm/methods` passes
its three destructured callbacks and stops at `Object.values`, its one
refusal now. The destructured callbacks the `8d86959` table counted behind
`git/config`, `types/list`, `types/object/structurally_same` and `types/ts`
are no longer refusals, and `git/config`'s elision now stands in front of
another prohibited name: every read of its `sub` field, `String.prototype`'s
`sub`.

`emergent_testing/node` is then converted by the two rewrites
[`doc/CONVERTING.md` §1](../doc/CONVERTING.md#reading-say-what-type-the-key-has)
prescribes, each the one spelling the language has for the read it
replaces, as [#2826](https://github.com/functionalscript/functionalscript/pull/2826)'s
were: `data.name` in `log` becomes `entry(data, 'name')`, the own-property
read of a name a built-in prototype gives a value, and `file[cwd.length]`
in `located` becomes `file[Number(cwd.length)]`, the index being a number.
Both read what JavaScript read before. The rename follows into its two
importers, the reporter `module.mjs` and the proof; no `.f.mjs` imports the
module, so the third pass checks the same ten and converts none. The
authored `.f.js` population grows from 33 to 34, and `npm start compile`
checks 40.

Each row is the first actual refusal from the `resolve()` pipeline, and
the last column what else the compiler does not accept in the module. The
last column was measured, not read: each refusal was removed on a scratch
copy, in turn, until the copy was accepted, so a construct is listed only
where the compiler reported it. Locations are `line:column`; paths are
relative to `fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `ci/package/module.f.mjs` | 114:22 | `JSON.stringify` in `literal` | `JSON` is not admitted; also writes `tsconfig` with it |
| `git/config/module.f.mjs` | 563:12 | Elision in `const [, list]` in `tryEntries` | Every read of the `sub` field, `acc.sub` in `subStep` first, a prohibited property name |
| `media/rust/module.f.mjs` | 62:5 | `switch` in `character` | The loop in `exponentOf`: two `let` variables, an `if … else` assigning inside it, `Math.floor`; `Math.abs`; `Array(…).keys()`, a reserved word and a prohibited call; four forward references, `utf16Literal` to `utf16Units`, `f64Bits` to `bitsOf`, `u64Words` to `u64WordItems`, `u64WordItems` to `words` |
| `nanvm/methods/module.f.mjs` | 113:20 | `Object.values` in `rows` | Nothing: the one refusal |
| `types/list/module.f.mjs` | 51:9 | `if … else if` assigning to the parameter `head` inside the loop in `next` | In `next`, the tuple assignment, `continue` and `'head' in head`; `while` over a parameter in `trampoline`; the generator, `Symbol` and `yield` in `iterable`; a `return` guard inside the loop in `last`; `for…of` in `tryFold`; `'first' in notLazy` in `lengthList`; `const { from } = Array`; nine forward references, each `…Step` to the export after it |
| `types/map/module.f.mjs` | 10:42 | `new Map(...)` in `mapSet` | `new Map(...)` in `mapDelete`; `Map` is not a language type |
| `types/object/structurally_same/module.f.mjs` | 58:20 | `new Map(entries(b))` | `const { entries } = Object`: the `Object` global is a prohibited property name, and the language enumerates no keys |
| `types/ts/module.f.mjs` | 24:29 | Default parameter in `printer` | `switch` with fallthrough in `primitive`; `JSON.stringify` in `struct` and `primitive` |
| `website/browser-source/module.f.mjs` | 63:9 | Guard with `break` inside the loop in `read` | All in `read`: two loop variables and a `let` inside the loop, `continue`, `+=`, nested loops, and an `if` whose body neither returns nor throws |
| `website/demo/code/module.f.mjs` | 12:48 | Default parameter in `codeBlock` | Nothing: the one refusal |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = [
  'ci/package', 'git/config', 'media/rust', 'nanvm/methods', 'types/list',
  'types/map', 'types/object/structurally_same', 'types/ts',
  'website/browser-source', 'website/demo/code',
];
for (const leaf of leaves) {
  const result = await runNodeEffect(resolve(absolute('fjs', leaf, 'module.f.mjs')));
  console.log(leaf, result[0] === 'ok' ? 'accepted' : JSON.stringify(result[1]));
}
```

After a compiler feature lands, rediscover the runtime dependency leaves,
compile every candidate, rename accepted modules and update their references,
then rediscover and repeat until a pass accepts none. Update this table with
the remaining refusals.

#### Leaf migration fixed point at `8d86959` (historical)

Measured at `8d86959`, the head of `main` after
[#2861](https://github.com/functionalscript/functionalscript/pull/2861)
admitted destructuring in `const`. A leaf is as defined in the `5dcd94b`
audit below, and the embedded-proof fixture is `example.f.js`, converted, so
there is none to report separately.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 13 | `website/cli/search` |
| 2 | 12 | None: every remaining leaf is refused |

`website/cli/search` compiles whole: `toLowerCase`, `includes` and `trim`
are on [`fjs/js/prototype`](../fjs/js/prototype/module.f.js)'s
`allowedCalls`, so a call of one is a method call the language admits, and
only a detached read of the name stays refused. The conversion changes the
extension and its two importers, `website/cli-runtime.mjs` and the proof;
no `.f.mjs` imports the module, so its rename exposes no new leaf. The
authored `.f.js` population under `fjs/` grows from 31 to 32, and `npm start
compile` checks 38 with the specification's vectors.

Destructuring in `const` moves three first refusals. `emergent_testing/node`
is refused at the destructured parameter the `const` pattern stood behind;
`git/config` passes its five `const` patterns and stops at the elision in
`const [, list]`, a hole the pattern grammar does not read; and
`types/object/structurally_same` passes `const { entries } = Object` as a
pattern and stops at `new Map`, with the `Object` global, a prohibited
property name, behind it. The `toLowerCase` sites the `#2858` table counted
behind `git/config` and `media/rust` are no longer refusals.

Each row is the first actual refusal from the `resolve()` pipeline, and
the last column what else the compiler does not accept in the module.
Locations are `line:column`; paths are relative to `fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `ci/package/module.f.mjs` | 114:22 | `JSON.stringify` in `literal` | `JSON` is not admitted; also writes `tsconfig` with it |
| `emergent_testing/node/module.f.mjs` | 25:18 | Destructured parameter in `coverage` | The computed key `file[cwd.length]` in `located`, no `Number(...)`; a destructured parameter in `log` |
| `git/config/module.f.mjs` | 563:12 | Elision in `const [, list]` in `tryEntries` | Destructured parameters in `lineStep`, `valueAt` and `extensionAt` |
| `media/rust/module.f.mjs` | 62:5 | `switch` in `character` | `let`/`while` in the exponent search, `Math.floor`, `Math.abs`, four forward references |
| `nanvm/methods/module.f.mjs` | 102:41 | Destructured callback parameter in `pairs` | `Object.values` in `listed`; destructured callbacks in `absent` and `table` |
| `types/list/module.f.mjs` | 51:9 | Assignment to `head`, not the loop's variable, in `next` | `while` over a parameter in `trampoline`, the generator in `iterable`, `const { from } = Array`, `for…of` in `tryFold`, destructured `({ first, tail })` callbacks throughout |
| `types/map/module.f.mjs` | 10:42 | `new Map(...)` in `mapSet` | `Map` is not a language type |
| `types/object/structurally_same/module.f.mjs` | 58:20 | `new Map(entries(b))` | `const { entries } = Object`: the `Object` global is a prohibited property name, and the language enumerates no keys; the destructured `([k, v])` callback |
| `types/ts/module.f.mjs` | 24:29 | Default parameter in `printer` | `switch`, a destructured callback, `JSON.stringify` |
| `website/browser-source/module.f.mjs` | 63:9 | Guard with `break` inside the loop in `read` | The lexer's two loop variables, nested loops and guards in `read` |
| `website/demo/code/module.f.mjs` | 12:48 | Default parameter in `codeBlock` | The computed key `[codeMarker]` |
| `website/prs/load/module.f.mjs` | 106:41 | Destructured parameter in `finishedNote` | Three more destructured parameters |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = [
  'ci/package', 'emergent_testing/node', 'git/config', 'media/rust',
  'nanvm/methods', 'types/list', 'types/map',
  'types/object/structurally_same', 'types/ts', 'website/browser-source',
  'website/demo/code', 'website/prs/load',
];
for (const leaf of leaves) {
  const result = await runNodeEffect(resolve(absolute('fjs', leaf, 'module.f.mjs')));
  console.log(leaf, result[0] === 'ok' ? 'accepted' : JSON.stringify(result[1]));
}
```

After a compiler feature lands, rediscover the runtime dependency leaves,
compile every candidate, rename accepted modules and update their references,
then rediscover and repeat until a pass accepts none. Update this table with
the remaining refusals.

#### Leaf migration fixed point on #2858 (historical)

Measured on [#2858](https://github.com/functionalscript/functionalscript/pull/2858),
the pull request that adds `bigint`, `BigInt(n)` on an integral number as
an importable function
([`doc/CONVERTING.md` §8](../doc/CONVERTING.md#8-bigint)), after
[#2851](https://github.com/functionalscript/functionalscript/pull/2851)
made `Object.is` one and
[#2854](https://github.com/functionalscript/functionalscript/pull/2854)
admitted the one-variable `let`/`while` loop. A leaf is as defined in the
`5dcd94b` audit below. The embedded-proof fixture is `example.f.js` since
[#2856](https://github.com/functionalscript/functionalscript/pull/2856),
converted, so there is none to report separately.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 13 | None: every leaf is refused |

The helper imports move what stands behind a first refusal, not the
refusal itself: `git/config` and `media/rust` import `bigint` in place of
`BigInt(number)`, `media/rust` and `website/prs/load` had already taken
`isNaN_`, `isNegativeZero`, `isFinite_` and `min`, and
`types/object/structurally_same` imports `is`. The loop moves two first
refusals past a module's first `let`: `types/list` is refused at the
assignment to a second name inside its loop, and `website/browser-source`
at the guard inside its, each a shape the one form does not admit. Two
leaves the audit at `6e392d4f2` did not list join the table:
`website/cli/search`, whose one refusal is a prohibited member call, and
`emergent_testing/node`, new since.

Each row is the first actual refusal from the `resolve()` pipeline, and
the last column what else the compiler does not accept in the module.
Locations are `line:column`; paths are relative to `fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `ci/package/module.f.mjs` | 114:22 | `JSON.stringify` in `literal` | `JSON` is not admitted; also writes `tsconfig` with it |
| `emergent_testing/node/module.f.mjs` | 26:11 | Destructuring `const { summary } = data` in `coverage` | A destructured parameter before it, more destructuring after |
| `git/config/module.f.mjs` | 473:11 | Destructuring `const { sub, after }` in `trySub` | `toLowerCase` at six sites, a prohibited member call; four more destructuring sites |
| `media/rust/module.f.mjs` | 62:5 | `switch` in `character` | `let`/`while` in the exponent search, `Math.floor`, `Math.abs`, `toLowerCase`, four forward references |
| `nanvm/methods/module.f.mjs` | 102:41 | Destructured callback parameter in `pairs` | `Object.values` in `listed`; destructured callbacks in `absent` and `table` |
| `types/list/module.f.mjs` | 51:9 | Assignment to `head`, not the loop's variable, in `next` | `while` over a parameter in `trampoline`, the generator in `iterable`, `const { from } = Array`, `for…of` in `tryFold`, destructured `({ first, tail })` callbacks throughout |
| `types/map/module.f.mjs` | 10:42 | `new Map(...)` in `mapSet` | `Map` is not a language type |
| `types/object/structurally_same/module.f.mjs` | 22:7 | Destructuring `const { entries } = Object` | `Object.entries`: the language enumerates no keys; `new Map` with `has` and `get` besides |
| `types/ts/module.f.mjs` | 24:29 | Default parameter in `printer` | `switch`, a destructured callback, `JSON.stringify` |
| `website/browser-source/module.f.mjs` | 63:9 | Guard with `break` inside the loop in `read` | The lexer's two loop variables, nested loops and guards in `read` |
| `website/cli/search/module.f.mjs` | 4:46 | `toLowerCase` in `matches`, a prohibited member call | Nothing else |
| `website/demo/code/module.f.mjs` | 12:48 | Default parameter in `codeBlock` | The computed key `[codeMarker]` |
| `website/prs/load/module.f.mjs` | 106:41 | Destructured parameter in `finishedNote` | Three more destructured parameters |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = [
  'ci/package', 'emergent_testing/node', 'git/config', 'media/rust',
  'nanvm/methods', 'types/list', 'types/map',
  'types/object/structurally_same', 'types/ts', 'website/browser-source',
  'website/cli/search', 'website/demo/code', 'website/prs/load',
];
for (const leaf of leaves) {
  const result = await runNodeEffect(resolve(absolute('fjs', leaf, 'module.f.mjs')));
  console.log(leaf, result[0] === 'ok' ? 'accepted' : JSON.stringify(result[1]));
}
```

After a compiler feature lands, rediscover the runtime dependency leaves,
compile every candidate, rename accepted modules and update their references,
then rediscover and repeat until a pass accepts none. Update this table with
the remaining refusals.

#### Leaf migration fixed point at `6e392d4f2` (historical)

Measured at `6e392d4f2`, a commit of
[#2823](https://github.com/functionalscript/functionalscript/pull/2823), the
compiler that accepts untagged template literals, which the audit below had
recorded as the first refusal in nine of its twelve leaves. A leaf is as
defined there, and the embedded-proof fixture is reported separately again.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 12 | `nanvm/member`, `website/style` |
| 2 | 11 | None: every remaining leaf is refused |

The two conversions change only their extension and references; the
template literal was each module's one refusal. Converting `website/style`
exposes `website/demo/code`, refused first for the default parameter in
`codeBlock`, with the computed key `{ [codeMarker]: '' }` behind it, as the
table below records. The authored `.f.js`
population grows from 27 to 29, all accepted by `npm start compile`.

This pass converts no module by rewriting it: a module whose source the
compiler refuses stays `.f.mjs`, readable as written, until the feature it
uses lands. A rewrite that spells `Number.isFinite` with the operators, or
reads a destructured parameter property by property, is a second spelling
of what JavaScript already says, and this migration does not pay for one.

[#2826](https://github.com/functionalscript/functionalscript/pull/2826)
then rewrote the two reads of a computed key the leaves still had as the
language's own spellings: `nanvm/methods` reads `p[type]` as
`entry(p, type)` and `types/list` reads `array[i]` as `array[Number(i)]`
([reading an entry at run time](../spec/README.md#reading-an-entry-at-run-time),
[property access](../spec/README.md#property-access)). That is not a rewrite
of the kind above: each is the read JavaScript performed, in the one
spelling the language has for it. `website/demo/code`'s `{ [codeMarker]: '' }`
is an object-literal key, not a read, and has no such spelling; it stays.
The `nanvm/methods` row below is measured at `e97397eb2`, the rewrite's
commit; `types/list`'s first refusal did not move.

The eleven implementation leaves below cannot be renamed with their current
source. Each row is the first actual refusal from the `resolve()` pipeline;
where a rewrite in supported syntax was tried on a copy, the last column
names what it reached before the compiler refused again. Locations are
`line:column`; paths are relative to `fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `ci/package/module.f.mjs` | 114:22 | `JSON.stringify` in `literal` | `JSON` is not admitted; also writes `tsconfig` with it |
| `git/config/module.f.mjs` | 472:11 | Destructuring `const { sub, after }` | `BigInt(number)` at three sites, `toLowerCase` at six, five more destructuring sites |
| `media/rust/module.f.mjs` | 59:5 | `switch` in `character` | `BigInt(number)` in `bitsOf`, `Array(n)`, `let`/`while`, `Math`, `Number.isNaN`, `Object.is`, `toLowerCase`, four forward references |
| `nanvm/methods/module.f.mjs` | 102:41 | Destructured callback parameter in `pairs` | `Object.values` in `rows`; a second destructured callback in `absent` |
| `types/list/module.f.mjs` | 40:5 | `while` and reassignment in `trampoline` | The generator in `iterable`, `Array.from`, the imperative `next` |
| `types/map/module.f.mjs` | 10:42 | `new Map(...)` in `mapSet` | `Map` is not a language type |
| `types/object/structurally_same/module.f.mjs` | 20:7 | Destructuring `const { entries, is } = Object` | `Object.entries`: the language enumerates no keys; `Map` besides |
| `types/ts/module.f.mjs` | 22:29 | Default parameter in `printer` | `switch`, a destructured callback, `JSON.stringify` |
| `website/browser-source/module.f.mjs` | 54:5 | `let` in `read` | The `let`/`while` lexer in `read` |
| `website/demo/code/module.f.mjs` | 12:48 | Default parameter in `codeBlock` | The computed key `[codeMarker]` |
| `website/prs/load/module.f.mjs` | 103:41 | Destructured parameter in `finishedNote` | Two more destructured parameters, `Number.isFinite`, `Math.min` |

The separate fixture `emergent_testing/example.f.mjs` was refused at `15:1`:
a block body whose only statement is a guard, which the compiler reads to
its end without a `return`.
[#2856](https://github.com/functionalscript/functionalscript/pull/2856)
converts it to `example.f.js` with `return undefined` after each guard — a
rewrite, unlike the two conversions above, and the one kind this migration
pays for: it spells the value JavaScript already answered there rather than
a second spelling of an expression
([CONVERTING rule 7](../doc/CONVERTING.md#7-a-body-that-ends-without-return)).
Since the fixture is the one `.f.js` that exports a `proof`, the same change
widens the website's `authored` selector to `.f.js`, so the browser suite
keeps it. The authored `.f.js` population is 30. The eleven implementation
leaves above are untouched by it, so the loop still stops there.

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = [
  'ci/package', 'git/config', 'media/rust', 'nanvm/methods', 'types/list',
  'types/map', 'types/object/structurally_same', 'types/ts',
  'website/browser-source', 'website/demo/code', 'website/prs/load',
];
for (const leaf of leaves) {
  const result = await runNodeEffect(resolve(absolute('fjs', leaf, 'module.f.mjs')));
  console.log(leaf, result[0] === 'ok' ? 'accepted' : JSON.stringify(result[1]));
}
```

After a compiler feature lands, rediscover the runtime dependency leaves,
compile every candidate, rename accepted modules and update their references,
then rediscover and repeat until a pass accepts none. Update this table with
the remaining refusals.

#### Leaf migration fixed point at `5dcd94b` (historical)

The iterative audit in [#2812](https://github.com/functionalscript/functionalscript/pull/2812)
starts from `4e663c19c`. A leaf is an authored, non-proof `.f.mjs` with no
runtime import or re-export of another `.f.mjs`; JSDoc and TypeScript-only
imports do not count. Demos and supporting FunctionalScript modules do count.
The embedded-proof test fixture `emergent_testing/example.f.mjs` is reported
separately, as in the earlier audits.

JavaScript AST dependency discovery found fifteen initial implementation leaves.
None compiled unchanged. Small, value-preserving rewrites using already supported
syntax made five of them eligible, and the dependency loop exposed one more
eligible module. Runtime imports, type references, proofs and documentation follow
each rename; proofs retain `.f.mjs`. The compiler and exported signatures stay
unchanged.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 15 | `types/function`, `js/keywords` |
| 2 | 15 | `types/nominal`, `edag/rust/unmarked` |
| 3 | 13 | `types/result` |
| 4 | 13 | `website/demo/examples` |
| 5 | 12 | None: every remaining leaf is refused |

The compatibility rewrites preserve the existing contracts:

- `types/function`: `iterate` uses balanced recursion, retaining exactly `n`
  sequential applications and unchanged results for non-positive counts, with
  logarithmic stack depth. Its proof also exercises 100,000 iterations.
- `js/keywords`: membership over the existing fixed string arrays replaces
  private `Set` instances.
- `edag/rust/unmarked`: string spread replaces `Array.from`, numeric runtime
  keys use `Number(...)`, and tuple callbacks bind static-index reads.
- `types/result`: static tuple reads replace destructured parameters; `okList`
  finds and returns the first error tuple unchanged, or maps successful values.
- `website/demo/examples`: array membership detects repeated strings, and tuple
  callbacks use static-index reads, preserving selections and duplicate refusals.
- `types/nominal`: only its extension and references change.

Converting `types/function` exposes `types/list` and `types/nominal`; the latter
converts in the next pass. Converting `types/result` exposes `media/rust`.
The other conversions expose no additional `.f.mjs` leaves. The authored `.f.js`
population grows from 21 to 27, all accepted by `npm start compile`.

The final twelve implementation leaves below cannot be renamed with their current
source. Each row is the first actual refusal from the same `resolve()` pipeline
that `fjs compile` with no arguments uses, rather than a serializer or Rust-output
restriction. Locations are `line:column`; paths are relative to `fjs/`.
Other unsupported constructs may follow the first one. The template literals
remain readable source pending compiler support; this migration does not replace
large text templates or substantially rewrite the remaining modules.

| Leaf file | Location | First refused construct |
| --- | ---: | --- |
| `ci/package/module.f.mjs` | 32:56 | Template literal in `consumerDirectory` |
| `git/config/module.f.mjs` | 400:60 | Template literal extending `pending` |
| `media/rust/module.f.mjs` | 65:44 | Template literal producing a Rust Unicode escape |
| `nanvm/member/module.f.mjs` | 335:13 | Template literal in a generated test name |
| `nanvm/methods/module.f.mjs` | 125:21 | Template literal in `path` |
| `types/list/module.f.mjs` | 40:5 | `while` and reassignment in `trampoline` |
| `types/map/module.f.mjs` | 10:42 | `new Map(...)` in `mapSet` |
| `types/object/structurally_same/module.f.mjs` | 20:7 | Destructuring `const { entries, is } = Object` |
| `types/ts/module.f.mjs` | 13:5 | Template literal in `complex` |
| `website/browser-source/module.f.mjs` | 89:35 | Template literal assembling browser source |
| `website/prs/load/module.f.mjs` | 28:5 | Template literal in `pageRequest` |
| `website/style/module.f.mjs` | 110:27 | Template literal containing the stylesheet |

The separate fixture `emergent_testing/example.f.mjs` also remains refused:
the template literal in `checkMul` at `14:34`. Since the final pass converts
nothing, it exposes no new leaves and the loop stops. The older measurements
below retain their revision-specific paths and diagnostics.

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = [
  'ci/package', 'git/config', 'media/rust', 'nanvm/member', 'nanvm/methods',
  'types/list', 'types/map', 'types/object/structurally_same', 'types/ts',
  'website/browser-source', 'website/prs/load', 'website/style',
];
for (const leaf of leaves) {
  const result = await runNodeEffect(resolve(absolute('fjs', leaf, 'module.f.mjs')));
  console.log(leaf, result[0] === 'ok' ? 'accepted' : JSON.stringify(result[1]));
}
```

#### Leaf check at `e67123d58` (historical)

The leaf check at `e67123d58`, the `String` PR stacked on the shared integer
predicate, found seventeen implementation leaves: only `array_index` compiled.
It is now migrated to
[`fjs/js/array_index/module.f.js`](../fjs/js/array_index/module.f.js), with its
runtime callers and proof import updated; its proof remains `proof.f.mjs`.
`types/set` is no longer a leaf: it imports `.f.mjs` modules from
`common/monoid`, `types/list` and `types/number`.

The sixteen remaining implementation leaves below are measured at
`e67123d58`. Each row gives the first compiler refusal, not every blocker in
the file. Locations are `line:column`; paths are relative to `fjs/`.

| Leaf file | Location | First refused construct |
| --- | ---: | --- |
| `ci/package/module.f.mjs` | 32:56 | Template literal in `consumerDirectory` |
| `git/bytes/module.f.mjs` | 25:35 | Computed key `b[at]`; it must use `Number(...)` |
| `git/config/module.f.mjs` | 90:57 | `\v` escape |
| `js/keywords/module.f.mjs` | 103:24 | `new Set(keywords)` |
| `nanvm/member/module.f.mjs` | 59:38 | `\u{1F600}` escape |
| `nanvm/methods/module.f.mjs` | 125:21 | Template literal in `path` |
| `types/function/module.f.mjs` | 33:5 | `let v = value` in `iterate` |
| `types/function/operator/module.f.mjs` | 11:5 | Template literal in `join` |
| `types/map/module.f.mjs` | 10:42 | `new Map(...)` |
| `types/object/structurally_same/module.f.mjs` | 20:7 | Destructuring `const { entries, is } = Object` |
| `types/result/module.f.mjs` | 111:5 | `for (const r of list)` in `okList` |
| `types/ts/module.f.mjs` | 13:5 | Template literal in `complex` |
| `website/browser-source/module.f.mjs` | 89:35 | Template literal |
| `website/demo/code/module.f.mjs` | 26:52 | `\0` escape |
| `website/demo/examples/module.f.mjs` | 54:13 | `new Set(...)` |
| `website/style/module.f.mjs` | 95:27 | Template literal containing the stylesheet |

The separate leaf `emergent_testing/example.f.mjs`, which embeds its proof,
first refuses the template literal in `checkMul` at `14:34` in the same snapshot.
No caller of `array_index` is ready to rename with it: their other `.f.mjs`
dependencies or compiler refusals remain.

The following historical measurement is pinned to `08d013b`, the then-head of
`main`: every `.f.mjs` that imports no
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
| `fjs/types/object/structurally_same` | 231 | destructuring (`const { entries, is } = Object`, `([k, v]) =>`), the `Object` global, `new Map`, a runtime number key `b[i]` |
| `fjs/types/function` | 223 | `let`, reassignment and `while`, all inside `iterate` |
| `fjs/types/function/operator` | 220 | template literals, destructured `const`s, runtime number keys `steps[i]` and `prior[i]` |
| `fjs/types/result` | 152 | `for … of` in `okList`, destructured parameters |
| `fjs/js/array_index` | 57 | `Number.isInteger`, the `String` global |
| `fjs/js/keywords` | 32 | `new Set` |
| `fjs/types/set` | 31 | `let`, reassignment, `+=`, `while` with `break`, `new Set`, a runtime number key `set[i]` |
| `fjs/types/map` | 27 | `new Map`, a destructured parameter |
| `fjs/website/demo/examples` | 25 | `new Set`, destructured parameters |
| `fjs/website/style` | 25 | a template literal, with two substitutions, and nothing else |
| `fjs/ci/package` | 7 | template literals, the `JSON` global |
| `fjs/website/demo/code` | 6 | template literals, a `'\0'` escape |
| `fjs/git/bytes` | 5 | runtime number keys `b[at]` and `b[i]`, `Number.isSafeInteger` |
| `fjs/nanvm/member` | 4 | `\u{…}` escapes, template literals |
| `fjs/nanvm/methods` | 2 | template literals, destructured parameters, the `Object` global, a runtime string key `p[type]` |
| `fjs/types/ts` | 2 | template literals, a destructured parameter, `switch` (no `default`, so the body can end without a `return`), a default parameter, the `JSON`, `isFinite` and `String` globals |
| `fjs/git/config` | 1 | `\v` and `\0` escapes, destructuring, the `BigInt` global, runtime string keys `escapes[c]`, `factors[…]` and `prefixes[…]`, a runtime number key `values[values.length - 1]`, `toLowerCase` (a prohibited member function), `acc.sub` (a prohibited property name), template literals |
| `fjs/website/browser-source` | 1 | `let`, `+=`, `while` with `break` and `continue`, a non-terminating `if`, eight runtime number keys, `source[index]` and `list[at]` among them, template literals |

The table above is a historical measurement. `array_index` now imports
[`types/number/is_integer`](../fjs/types/number/is_integer/module.f.js), whose
`isInteger` uses `typeof` and `%` rather than `Number.isInteger`. Its bounds
and canonical string round-trip are unchanged. With
[`String` conversion](../spec/README.md#string-conversion) admitted,
`array_index` now compiles through its shared integer predicate and canonical
string check; the rename above completes that migration step.
`types/number`, ASCII digit parsing, Unicode surrogate
conversion, and Node/web validation reuse the same predicate.

Compared with the previous measurement at `4c8ec55`, the `08d013b` snapshot
had the same eighteen leaves and compiler progress on three of them.
`Number(exp)` is in the language and `Number` a reserved word
([number conversion](../spec/README.md#number-conversion)), so
`array_index`'s `Number(key)` compiled at that snapshot, while the module
still stopped at `Number.isInteger`, before reaching the `String` global.
The shared integer predicate and admitted `String` call described above are
later progress, not changes present in that snapshot.
`git/bytes` still uses `Number.isSafeInteger`,
a member of `Number` and an admission of its own. A computed key now parses,
refused unless it is `a[Number(i)]`, and is `git/bytes`' first refusal; every
row with a runtime key says which of the language's two rewrites it takes, a number
key's `a[Number(i)]` or a string key's `entry(a, k)`. `structurally_same` no
longer waits on `instanceof`: all three of its uses have `Array` on the right
([`instanceof`](../spec/README.md#instanceof)). Two leaves changed their
source: `keywords` builds a second `new Set`, the same feature, and `style`'s
stylesheet now substitutes two string `const`s. `style` also has 25 modules
behind it, not 5: `fjs/website/demo`, which every demo imports, imports it.
Three readings were corrected, each refused by the `4c8ec55` compiler as well:
`function/operator` destructures no parameter, `git/bytes` reads a second
key, `b[i]`, and `git/config` also calls the `BigInt` global, reads `acc.sub`
and has two more runtime keys.

The same historical `08d013b` rows by feature, each with where the feature is
tracked, so a language step can be picked for what it unblocks. This table
records that snapshot's blockers, including the since-migrated `array_index`:

| Feature | Tracked in | Leaves it held at `08d013b` |
| --- | --- | --- |
| Template literals | now implemented ([spec: template literals](../spec/README.md#template-literals)) | function/operator, ci/package, ts, nanvm/methods, nanvm/member, style, demo/code, git/config, browser-source |
| Destructuring | [`spec/todo/2450-destructuring.md`](../spec/todo/2450-destructuring.md) | structurally_same, result, function/operator, map, demo/examples, ts, git/config, nanvm/methods |
| A runtime key that is a string, `a[k]` | in the language as the `entry` helper ([spec: entry](../spec/README.md#reading-an-entry-at-run-time)); the module rewrites `a[k]` as `entry(a, k)`, imported from [`fjs/js/entry`](../fjs/js/entry/module.f.js) | git/config, nanvm/methods |
| A runtime key that is a number, `a[i]` | in the language as the conversion `a[Number(i)]` ([spec: property access](../spec/README.md#property-access)), the EDAG's `['.', a, ['Number', i]]`; the module rewrites `a[i]` as `a[Number(i)]`, not `entry` | structurally_same, function/operator, set, git/bytes, git/config, browser-source |
| Globals and built-ins | [`spec/todo/2365-global-names.md`](../spec/todo/2365-global-names.md), [`2360-built-in.md`](../spec/todo/2360-built-in.md); of `Number`, only the call `Number(exp)` is in the language ([spec: number conversion](../spec/README.md#number-conversion)), each member an admission of its own | structurally_same, array_index, ts, git/bytes, nanvm/methods, ci/package, git/config |
| `new` with a built-in constructor | nothing proposes it; `Map` and `Set` are undecided in [`2360-built-in.md`](../spec/todo/2360-built-in.md) | structurally_same, keywords, map, set, demo/examples |
| `let`, reassignment, `+=`, `while` | [`spec/todo/3220-let.md`](../spec/todo/3220-let.md); `+=` is [`3430-assignments.md`](../spec/todo/3430-assignments.md); `while` is [roadmap §3.2](../spec/todo/README.md#32-priority-2) | function, set, browser-source |
| String escapes `\u{…}`, `\v`, `\0` | [`spec/todo/2460-js-string-literals.md`](../spec/todo/2460-js-string-literals.md) | nanvm/member, demo/code, git/config |
| A non-terminating `if`, `break`, `continue` | [roadmap §3.2](../spec/todo/README.md#32-priority-2), the guard's follow-ups; `break` and `continue` are `while`'s | set, browser-source |
| `for … of` | nothing proposes it | result |
| `switch`, a default parameter | neither proposed; [`3120-parameters.md`](../spec/todo/3120-parameters.md) leaves a default parameter for later | ts |
| A prohibited member function, `toLowerCase`, or property name, `sub` | `toLowerCase` is now admitted ([spec: built-in member functions](../spec/README.md#built-in-member-functions)); `sub` stays a prohibited property name, [`fjs/js/prototype`](../fjs/js/prototype/module.f.js)'s `prototypeNames` ([spec: property access](../spec/README.md#property-access)), and the module rewrites it, not the language | git/config |

A leaf renames only when every feature it uses has landed. In that historical
snapshot, these leaves waited on one feature alone: `style` on template literals,
`keywords` on `new Set`,
and `git/bytes` on `Number.isSafeInteger`
once its keys are read as `b[Number(…)]`. Of the four root modules nearly
everything imports, `structurally_same` waits on three features — destructuring,
the `Object` global and `new Map` — and `function/operator` on two, template literals and
destructuring; the runtime keys of both are rewrites the language already
has. `iterate` in `function` could lose its loop today, which would leave
that module on nothing — `let`, reassignment and `while` are all inside
`iterate`, a recursion that halves `n` compiles, and the shorthand `result`
in the object `fn` returns is in the language
([objects](../spec/README.md#objects)) — the one rename no language step
gates. `okList` in `result` could lose its `for … of` the same way, but
`unwrap` and `invert` take destructured parameters, so that root waits on
destructuring either way. Template literals hold nine leaves and
destructuring eight, more than any other feature.

#### Leaf escape normalization

An audit of the authored implementation modules at `40e196a51` found
16 `.f.mjs` leaves: modules with no runtime import or re-export of another
`.f.mjs`. Type-only JSDoc imports do not count. Proofs retain their extension;
`emergent_testing/example.f.mjs` is a test example rather than an implementation
module and is excluded. At that revision, `js/array_index` and `types/set`
imported other `.f.mjs` modules, so they were no longer leaves. The eighteen-row
table above records the earlier dependency graph.

The source and compiler for the refusal table are pinned to the `main` revision
`40e196a51`, with only the 17 string-escape replacements listed below applied
to a scratch checkout. All 16 candidates still fail that compiler after
normalization. The table gives each first reported refusal, rather than a
complete list of blockers; the historical feature analysis above remains
useful for the other restrictions.

| Leaf (`fjs/…/module.f.mjs`) | First refusal (line:column) |
| --- | --- |
| `ci/package` | template literal, 32:56 |
| `git/bytes` | computed key is not `Number(...)`, 25:35 |
| `git/config` | template literal, 398:60 |
| `js/keywords` | `new Set`, 101:24 |
| `nanvm/member` | template literal, 335:13 |
| `nanvm/methods` | template literal, 125:21 |
| `types/function` | `let`, 33:5 |
| `types/function/operator` | template literal, 11:5 |
| `types/map` | `new Map`, 10:42 |
| `types/object/structurally_same` | destructuring, 20:7 |
| `types/result` | `for … of`, 111:5 |
| `types/ts` | template literal, 13:5 |
| `website/browser-source` | template literal, 89:35 |
| `website/demo/code` | template literal, 26:71 |
| `website/demo/examples` | `new Set`, 54:13 |
| `website/style` | template literal, 95:27 |

Unsupported string escapes in these leaves have supported, value-preserving
spellings, so they need no new language feature. The replacement counts and
source positions below refer to the source at `40e196a51`; the replacements
preserve its line numbers:

| Replacement | Where | Occurrences |
| --- | --- | ---: |
| `\v` → `\u000B` | `git/config`, line 90 | 1 |
| `\0` → `\u0000` | `git/config`, lines 434 and 479; `website/demo/code`, line 26 | 3 |
| `\u{1F600}` → `\uD83D\uDE00` | `nanvm/member` test-corpus string values | 13 |

To reproduce, make a detached checkout of
`40e196a5191ece2081f7d6bc82f1aaeb70da6f52`, apply the 17 replacements above
to string literals in those three files, then run the checkout's CLI for each
table row:

```bash
./dev.sh node fjs/module.mjs compile fjs/git/config/module.f.mjs /tmp/git-config.rs
```

Use each candidate's path in place of `fjs/git/config/module.f.mjs`. The
diagnostics refer to the normalized copy; the source and compiler revision is
retained on `main`.

These three leaves no longer wait on string-escape support. They stay `.f.mjs`
until the remaining restrictions clear; the deferred escape proposal is not
needed for their migration. Escape spellings in explanatory comments and
non-leaf modules are outside this normalization.

#### The whole repository

The same loop over every authored module, not only the leaves, measured at
`4c8ec55`: of 228 modules — 222 `module.f.mjs` and 6 `module.f.js`
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

Template literals were the first refusal of two modules in five in these
snapshots, almost all of them error messages and `assert` texts. Untagged
templates are now implemented ([spec: template literals](../spec/README.md#template-literals)).
Destructuring was next, and the string-escape row is tokenizer work. The leaf
table above is what this count does not say: a module whose
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
([console-program](../nanvm/lib/todo/console-program.md)), which interprets
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
      [harness fixtures](../nanvm/harness/fixtures).
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
      waits for a use ([`main.rs`](../nanvm/harness/src/main.rs)).
- [x] Inline source dependencies into one generated Rust output.
      `rustText` in the [compiler](../fjs/compiler/module.f.mjs) resolves the complete
      graph before calling `toRust`; source imports do not become separate
      Rust modules. The harness includes each generated fixture via `#[path]`
      as its own embedding choice.
- [x] Prove the pipeline with a minimal synthetic JavaScript FunctionalScript
      subset: a constant default export compiled by `fjs` to `.rs`, built and
      run by cargo, with the result printed to stdout as JSON —
      `nanvm/harness/fixtures/{number,boolean,string}.mjs` — then extended to
      arrays, objects, `const`-sharing, and string-keyed property access —
      `nanvm/harness/fixtures/{array,object,sharing,property}.mjs`, matched
      by [`Any::to_json`](../nanvm/lib/src/vm/any/to_json.rs) recursing into
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
- [x] Rename `fjs/js/array_index/module.f.mjs` to `.f.js` after the shared
      integer predicate and `String` conversion made the complete module
      compiler-compatible; update its callers and proof import, keeping
      `proof.f.mjs`.
- [x] Run the iterative leaf migration in #2812: convert `types/function`,
      `js/keywords`, `types/nominal`, `edag/rust/unmarked`, `types/result` and
      `website/demo/examples`; preserve their APIs and record the final twelve
      implementation leaf refusals plus the separate embedded-proof fixture.
- [x] Read every computed key in the leaves as the language does: a number
      key as `a[Number(i)]`, a string key as `entry(a, k)` — `nanvm/methods`
      and `types/list` in #2826. An object-literal key, `{ [k]: v }`, has no
      such spelling and stays: `website/demo/code`.
- [ ] Continue `.f.mjs` -> `.f.js` incrementally as compiler support grows.

### Related

- [`fjs/ci/package/module.f.mjs`](../fjs/ci/package/module.f.mjs) — the
  packed-package check closing the `node26` CI job, the clean-consumer check
  of a published `.f.js`.
- [`fjs/compiler/README.md`](../fjs/compiler/README.md) — the extension contract, and the
  stage-1/stage-2 boundary this migration starts from.
- [nanvm/lib/todo/mvp-roadmap.md](../nanvm/lib/todo/mvp-roadmap.md) — the
  design decided around the MVP pipeline and the post-MVP tasks; this file
  holds the MVP definition and its tasks.
- [nanvm/lib/todo/console-program.md](../nanvm/lib/todo/console-program.md) —
  the self-hosted `nanvm` crate (post-MVP).
- [authored `.mjs` package support](../fjs/ci/todo/f-mjs-package-support.md) —
  stage-1 validation, declaration, and package prerequisite.
- [`publishing-packages.md`](../fjs/ci/todo/publishing-packages.md) — broader
  package-publishing roadmap.
- [`fjs/edag`](../fjs/edag/README.md) — the schema of the code-describing
  `Any`, shared by the compiler and FJS interpreter.
