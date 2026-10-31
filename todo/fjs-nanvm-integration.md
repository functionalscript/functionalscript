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
object, as the [module contract](../spec/modules/exports/README.md) already
requires on `main`. For example, `export const answer = 42; export default 7;`
returns `{ answer: 42, default: 7 }`. Without `export default`, there is no
`default` property. Module evaluation creates exported functions; invoking
one is a separate consumer operation.

Source dependencies are already linked into one EDAG before Rust generation.
Each `fjs compile <input> <output>.rs` invocation writes one Rust file containing
that complete graph, following the
[import-inlining contract](../spec/modules/imports.md).
There is no pending convention for Rust imports between source dependencies.
The embedding crate chooses where to include the generated file.

[Named imports](../spec/modules/imports.md) now select named
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

Measured on `b777ddb02`, the rename step of
[#3494](https://github.com/functionalscript/functionalscript/pull/3494).
The list refactor from `sergey/temp1` makes its recursive step helpers local
to their owning functions, removing the module-level forward references.
The compiler accepts the complete module and four dependents without further
implementation changes: `types/list`, `text/code_point`, `types/btree`,
`types/btree/remove` and `types/btree/set` are now `.f.js`, with their runtime,
type, proof and documentation references updated.

Runtime import and re-export declarations were rediscovered from JavaScript
ASTs under `fjs/` and `spec/`, excluding generated files and proofs. The
population is 163 authored `.f.js` files and 443 authored non-proof `.f.mjs`
files. Every remaining leaf was compiled as written; all six are refused.

| Leaf file | First refused construct | Additional leaves its conversion exposes |
| --- | --- | ---: |
| `fjs/common/monoid/module.f.mjs` | The later `accumulator` referenced by `fold` (`const not found`) | 4 |
| `fjs/types/array/module.f.mjs` | `new Map` in `occurrences`, whose keys are strings ([conversion rule 9](../doc/CONVERTING.md#9-a-map-or-a-set-of-strings)) | 6 |
| `fjs/types/list/alt/module.f.mjs` | Destructuring assignment in `push` (`unexpected token`) | 6 |
| `fjs/types/list/iterable/module.f.mjs` | The generator method `*[Symbol.iterator]` (`unexpected token`) | 0 |
| `fjs/types/map/module.f.mjs` | `new Map` in `mapSet`; its EDAG-node keys do not meet conversion rule 9 | 0 |
| `fjs/types/sorted_list/module.f.mjs` | The later `cmpReduce` referenced by `merge` (`const not found`) | 0 |

No further leaf compiles unchanged at this revision. The renamed modules keep
their `proof.f.mjs` files; the btree set/remove proofs also exercise the cases
needed for their own isolated 100% proof coverage.

#### Leaf migration fixed point at `d4b096a3a` (historical)

Measured on `d4b096a3a`, the conversion step of
[#3463](https://github.com/functionalscript/functionalscript/pull/3463),
stacked on [#3462](https://github.com/functionalscript/functionalscript/pull/3462).
Runtime import and re-export declarations were rediscovered from the JavaScript
ASTs of authored non-proof `.f.mjs` files under `fjs/` and `spec/`, skipping
generated files and JSDoc-only imports. Every remaining leaf was compiled as
written; all three are refused.

| Leaf file | First refused construct | Additional leaves its conversion exposes |
| --- | --- | ---: |
| `fjs/types/array/module.f.mjs` | `new Map` in `occurrences`, whose keys are strings ([conversion rule 9](../doc/CONVERTING.md#9-a-map-or-a-set-of-strings)) | 6 |
| `fjs/types/list/module.f.mjs` | The forward reference to `flat` in `flatStep` (`const not found`; [forward references](../spec/todo/3140-forward-references.md)) | 8 |
| `fjs/types/map/module.f.mjs` | `new Map` in `mapSet`; its EDAG-node keys do not meet conversion rule 9 | 0 |

The compiler-compatible population is 158 authored `.f.js` files; 446 authored
non-proof `.f.mjs` files remain. The new `.f.js` modules are the independent
monoid repetition, array repetition and `generate` helpers, plus the converted
[`WASM instruction table`](../fjs/media/wasm/instruction/module.f.js) and
[`Huffman module`](../fjs/zlib/huffman/module.f.js). Extracting repetition exposes
`types/array` as a leaf; renaming the two table modules exposes no further leaf.

`Array.from` becomes `generate`; Huffman's `Array(n).fill(v)` becomes
`repeat(n)(v)`, and numeric computed keys use `Number`. The WASM table reduces
its opcodes with the existing numeric `max` and reads mnemonic entries with
`entry`. Huffman's mapping callback captures a constant target index instead
of the reassigned loop variable. The compiler accepts both complete modules,
including the `break` in `decode`, which earlier audits had not reached.

#### Leaf migration fixed point at `d6b55c6` (historical)

Measured on `d6b55c6`, the head of
[#3443](https://github.com/functionalscript/functionalscript/pull/3443), the
specification step of the `in` operator, which stands on
[#3440](https://github.com/functionalscript/functionalscript/pull/3440),
[#3442](https://github.com/functionalscript/functionalscript/pull/3442) and
[#3447](https://github.com/functionalscript/functionalscript/pull/3447): the
compiler measured admits `"k" in o`, which `main` refuses until the stack
lands, and one row below moves because of it. A leaf is as defined in the
`5dcd94b` audit below. This time the leaves were found by reading the
`import` and `export … from` declarations of every authored non-proof
`.f.mjs` under `fjs/` and `spec/` — implementation modules, demos, samples
and test libraries alike, generated files skipped — and keeping each whose
every runtime import is an `.f.js`; a JSDoc `@import` does not count. Each
leaf was then compiled as written, and a refused one again in a copy, with
the smallest value-preserving respelling that moves past the refusal, until
the copy was accepted or the next refusal was one no respelling removes.
The accepted ones were converted in the same step, and the leaves
rediscovered.

| Pass | Leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 6 | `spec/undecided/samples`, accepted as written; `zlib/bits`, `js/ast/invocation` and `types/stack_walk`, each with the respelling below |
| 2 | 3 | None: `zlib/huffman`, which the `zlib/bits` rename exposed, is refused as written; `types/list` at a forward reference once its destructuring assignments are written as assignments; `types/map` as before |

What each conversion changed, beside the extension and the references
that follow it — the proof's import, the importers, and the documents that
link the module:

- `spec/undecided/samples`: nothing. One `const` of strings, the open
  rows' samples, which the [undecided page](../spec/undecided/README.md)
  compiles one by one. It is under `spec/`, which the earlier audits did
  not walk, and the rule in
  [AGENTS.md §3](../AGENTS.md#3-functionalscript-and-typescript-fjs) said it
  was misnamed. Its references are the page's `README.md`, `demo.f.mjs`
  and `proof.f.mjs`.
- `zlib/bits`: the one key computed at run time in `read`,
  `input[first + i]`, read as `input[Number(first + i)]`
  ([CONVERTING.md rule 1](../doc/CONVERTING.md#1-computed-keys)). The `for`
  the `1ce90e7` row stopped at is admitted, classic `for` lowering to
  `while`, and so are the two variables it steps and the `\|=` behind it
  ([compound assignments](../spec/bindings/variables/README.md#compound-assignments)).
  Its importers are `zlib/huffman` and `zlib/inflate`.
- `js/ast/invocation`, new since `1ce90e7` from
  [#3326](https://github.com/functionalscript/functionalscript/pull/3326):
  the `length` projections of the rest array in `_restTransition`, built
  by `Array.from({ length }, …)`, a global name with no admitted spelling
  (`reserved word`; [built-ins](../spec/todo/2360-built-in.md),
  [global names](../spec/todo/2365-global-names.md)), are built by
  `projections`, a recursive helper of the module; and `exit[2][length]`
  in `_restArguments` is read as `exit[2][Number(length)]`, the one refusal
  behind the first. `instanceof Array`, `.at(-1)`, `.slice` and `.every`
  are admitted. Its importers are `edag/from_fast/loop/root` and
  `edag/to_fast/tail`.
- `types/stack_walk`: the two destructuring assignments in `walkFold`'s
  loop, `[acc, step] = enter(acc, step[2])` and
  `[acc, step] = resume(acc, top, step[1])`, each through a `const`
  holding the pair, `const entered = enter(acc, step[2])` then
  `acc = entered[0]` and `step = entered[1]`. Destructuring assignment is
  what [variables](../spec/bindings/variables/README.md) leaves to a
  separate extension, and the
  [register](../spec/todo/refused-constructs.md) has no row for it. The
  `return` guards inside `while (true)` the `1ce90e7` row stopped at are
  admitted, the loop being a
  [terminal unconditional one](../spec/control-flow/loops/README.md#a-terminal-unconditional-loop)
  since [#3418](https://github.com/functionalscript/functionalscript/pull/3418).
  Its importers are `ebnf/ll1`, `media/datajs/parser`,
  `media/datajs/serializer` and `rust/serializer`.
- `types/list`, which stays `.f.mjs`: the two destructuring assignments
  in `next`, `[head, tail] = [head.head, concat(head.tail)(tail)]` and
  `[head, tail] = [tail, null]`, written as the plain assignments they
  are, `tail = concat(head.tail)(tail)` then `head = head.head`, and
  `head = tail` then `tail = null`. Each formed an array to take it apart
  again; with them gone the compiler reaches the forward reference below.

The authored `.f.js` population under `fjs/` grows from 62 to 65 — from
51 at `1ce90e7`, `types/function/compare` among the ones in between, since
#3418 admitted the terminal unconditional loop its `bsearch` ends in — and
`npm start compile` checks 152, 87 of them under `spec/`.

The three leaves left, measured at the same compiler. Locations are
`line:column`; paths are relative to the repository root.

| Leaf file | Location | First refused construct | Measured behind it |
| --- | ---: | --- | --- |
| `fjs/zlib/huffman/module.f.mjs` | 28:19 | `Array` in `Array.from({ length: 16 }, …)` in `code`, a global name (`reserved word`; [built-ins](../spec/todo/2360-built-in.md), [global names](../spec/todo/2365-global-names.md)), counting the lengths | With that, the second `Array.from` in `code`, the five `Array(n).fill(v)` of the fixed codes, `dynamic` and `nextLengths`, and every key computed at run time written out: `i`, the `for` variable of `dynamic`, captured by the `map` callback that places a length (`reassigned variable captured`, [variables](../spec/bindings/variables/README.md)). Not measured further; the `break` in `decode` is behind it |
| `fjs/types/list/module.f.mjs` | 80:19 | `flat` read in `flatStep` before its declaration, `flat` being `apply(flatStep)` (`const not found`, [forward references](../spec/todo/3140-forward-references.md)), the shape every `…Step` helper here shares with the export after it. The two destructuring assignments in `next` the first measurement stopped at are written as plain assignments in this step, and `'head' in head` before them, a blocker of the `1ce90e7` row, is admitted by the `in` operator this is measured with | Nothing: a forward reference is no respelling's to remove. Eight modules import no `.f.mjs` but this one — `common/monoid`, `text/code_point`, `types/btree` and its `remove` and `set`, `types/list/alt` and `iterable`, `types/sorted_list` — so it is the leaf whose conversion opens the most |
| `fjs/types/map/module.f.mjs` | 10:38 | `new` in `mapSet`, a reserved word: the `1ce90e7` row, unchanged; `Map` is not a language type, and its one importer, `edag/analysis`, keys the map by EDAG nodes, so rule 9 does not apply | Nothing |

To recheck the table without writing output, run this from the repository
root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = ['fjs/types/list/module.f.mjs', 'fjs/types/map/module.f.mjs', 'fjs/zlib/huffman/module.f.mjs'];
for (const leaf of leaves) {
  const result = await runNodeEffect(resolve(absolute(leaf)));
  console.log(leaf, result[0] === 'ok' ? 'accepted' : JSON.stringify(result[1]));
}
```

After a compiler feature lands, rediscover the leaves, compile every
candidate, rename accepted modules and update their references, then
rediscover and repeat until a pass accepts none. Update this table with the
remaining refusals.

#### Leaf migration fixed point at `1ce90e7` (historical)

Measured on `1ce90e7`, the head of `main` after
[#3150](https://github.com/functionalscript/functionalscript/pull/3150). A
leaf is as defined in the `5dcd94b` audit below, and the leaves were
rediscovered as the `0c9ddf8` table below says: every authored non-proof
module loaded through Node with a resolve hook recording each runtime
import.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 7 | `compiler/ast` and `js/ast/loop`, each accepted as written |
| 2 | 5 | None: every remaining leaf is refused as written |

There are seven leaves where the `7cee7a5` table below left five, because
two are new.
[#3143](https://github.com/functionalscript/functionalscript/pull/3143)
normalized structured source through FAST: `compiler/ast` lost its runtime
imports of `types/list` and `edag` and keeps only the operator tables and
their predicates, and `js/ast/loop`, new in the same pull request,
recognizes a scalar loop over FAST values. Neither imports an `.f.mjs` at
run time, and the compiler accepts both whole, so each is converted with
only its extension and its references changed: `compiler/ast`'s importers,
`compiler/parser` and `compiler/parser/grammar` with its `types.ts` and
`demo.f.mjs`, its own `types.ts`, the links from four `todo/` files and its proof;
`js/ast/loop`'s importers, `edag/from_fast` and `js/ast/prepare`, and its
proof. Both proofs stay `proof.f.mjs`.

The renames expose no leaf: every importer of either imports other
`.f.mjs` modules too. The second pass checks the five leaves left, against
the same compiler, and converts none.

The authored `.f.js` population under `fjs/` grows from 49 to 51, and
`npm start compile` checks 132. It is 49, not the 48 the `7cee7a5` text
counted, because
[#3145](https://github.com/functionalscript/functionalscript/pull/3145)
added `edag/testlib` and `js/ast/sugar/logical` as `.f.js` and
[#3138](https://github.com/functionalscript/functionalscript/pull/3138)
deleted the `sample` of `nanvm/demos/comma`, its demo folded into the
specification's page. The compile check's count is 130 before the renames,
not the 65 of `7cee7a5`, because the specification's refused-construct
pages since
[#3155](https://github.com/functionalscript/functionalscript/pull/3155)
hold 64 more `.f.js` samples, 81 under `spec/` in all.

The five rows are the `7cee7a5` table's, measured again, unchanged.
Locations are `line:column`; paths are relative to `fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `types/stack_walk/module.f.mjs` | 47:9 | `if (step[0] === 'error') { return step }`, a `return` guard inside `while (true)` in `walkFold`; the `let [acc, step] = …` before it is admitted since general bindings ([variables](../spec/bindings/variables/README.md)), which moved the row from 43:9 | Read, not measured: the tuple assignments `[acc, step] = …`, destructuring assignment, which no proposal admits; an `if … else if … else` whose branches `return` inside `while (true)`; `stack`, a second variable the loop assigns; and no `return` after `while (true)` |
| `types/function/compare/module.f.mjs` | 65:9 | `if (e < b) { return b }`, a `return` guard inside the loop in `bsearch` | In `bsearch`, a `switch` inside the loop whose cases assign `b` and `e` and end in `break`, no `return` after `while (true)`, and a second variable the loop assigns, `e` |
| `types/list/module.f.mjs` | 51:9 | `if … else if` assigning to the parameter `head` inside the loop in `next` | In `next`, the tuple assignments, `continue`, `'head' in head`, two `return` guards inside the loop, the assignment to `head`, not the loop's variable, and no `return` after `while (true)`; `while` over a parameter, with no `let`, in `trampoline`; in `iterable`, the generator, `Symbol` and `yield`, a bare `return` guard inside the loop and no `return` after `while (true)`; in `last`, a `return` guard inside the loop and no `return` after `while (true)`; in `tryFold`, `for…of` and a `return` guard inside it; `'first' in notLazy` in `lengthList`; `const { from } = Array`, `Array` a reserved word there; nine forward references, each `…Step` to the export after it |
| `types/map/module.f.mjs` | 10:38 | `new` in `mapSet`, a reserved word (`reserved word`): its line's `Map(...)` reads as a call statement of its own, which the fold refuses after it | `new Map(...)` in `mapDelete`; `Map` is not a language type. Its one importer, `edag/analysis`, keys the map by EDAG nodes, objects compared by identity, so rule 9 does not apply |
| `zlib/bits/module.f.mjs` | 33:5 | The `for` loop in `read` | Measured with the `for` rewritten as the admitted `while`: `input[first + i]`, a key computed at run time; behind it the two variables the loop steps, `word` and `i`. `let word` on its own is admitted since general bindings ([variables](../spec/bindings/variables/README.md)) |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = ['types/stack_walk', 'types/function/compare', 'types/list', 'types/map', 'zlib/bits'];
for (const leaf of leaves) {
  const result = await runNodeEffect(resolve(absolute('fjs', leaf, 'module.f.mjs')));
  console.log(leaf, result[0] === 'ok' ? 'accepted' : JSON.stringify(result[1]));
}
```

After a compiler feature lands, rediscover the runtime dependency leaves,
compile every candidate, rename accepted modules and update their references,
then rediscover and repeat until a pass accepts none. Update this table with
the remaining refusals.

#### Leaf migration fixed point at `7cee7a5` (historical)

Measured on `7cee7a5`, the head of
[#3114](https://github.com/functionalscript/functionalscript/pull/3114),
which renamed the NaNVM demo samples, with `git/config` renamed. A leaf is
as defined in the `5dcd94b` audit below, and the leaves were rediscovered
as the `0c9ddf8` table below says: every authored non-proof module loaded
through Node with a resolve hook recording each runtime import.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 6 | `git/config`, by renaming its private `_SubState`'s field `sub` to `part` |
| 2 | 5 | None: every remaining leaf is refused as written |

`git/config` held the one refusal its row in the `7baae35` table below
lists: `acc.sub`, `sub` being a name `String.prototype` gives a value,
which a read refuses whoever owns it
([property access](../spec/property-access/README.md)). The field is the
reader's own, a subsection's text so far, so it takes a name no prototype
gives a value, `part`; `name` is no such name, `Function.prototype` giving
it one. The local the subsection is bound to stays `sub`, a binding being
no read. Nothing else in the module changes. Its references follow, five
files with its proof, which stays `proof.f.mjs`.

The rename exposes no leaf: `git/format`, its one importer, imports other
`.f.mjs` modules too. The second pass checks the five leaves left, against
the same compiler, and converts none.

The authored `.f.js` population under `fjs/` grows from 47 to 48, and
`npm start compile` checks 65.

The five rows are the `7baae35` table's, measured again, unchanged.
Locations are `line:column`; paths are relative to `fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `types/stack_walk/module.f.mjs` | 43:9 | `let [acc, step] = …` in `walkFold`, a pattern where a loop's `let` takes a name | Read, not measured: a second `let`, `stack`; the tuple assignments `[acc, step] = …`; an `if … else if … else` whose branches `return` inside `while (true)`; the assignment to `stack`, not the loop's variable; and no `return` after `while (true)` |
| `types/function/compare/module.f.mjs` | 65:9 | `if (e < b) { return b }`, a `return` guard inside the loop in `bsearch` | In `bsearch`, a `switch` inside the loop whose cases assign `b` and `e` and end in `break`, no `return` after `while (true)`, and a second `let`, `e`, not the loop's variable |
| `types/list/module.f.mjs` | 51:9 | `if … else if` assigning to the parameter `head` inside the loop in `next` | In `next`, the tuple assignments, `continue`, `'head' in head`, two `return` guards inside the loop, the assignment to `head`, not the loop's variable, and no `return` after `while (true)`; `while` over a parameter, with no `let`, in `trampoline`; in `iterable`, the generator, `Symbol` and `yield`, a bare `return` guard inside the loop and no `return` after `while (true)`; in `last`, a `return` guard inside the loop and no `return` after `while (true)`; in `tryFold`, `for…of` and a `return` guard inside it; `'first' in notLazy` in `lengthList`; `const { from } = Array`, `Array` a reserved word there; nine forward references, each `…Step` to the export after it |
| `types/map/module.f.mjs` | 10:38 | `new` in `mapSet`, a reserved word (`reserved word`): its line's `Map(...)` reads as a call statement of its own, which the fold refuses after it | `new Map(...)` in `mapDelete`; `Map` is not a language type. Its one importer, `edag/analysis`, keys the map by EDAG nodes, objects compared by identity, so rule 9 does not apply |
| `zlib/bits/module.f.mjs` | 33:5 | The `for` loop in `read` | `let word`, with no `while` after it |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = ['types/stack_walk', 'types/function/compare', 'types/list', 'types/map', 'zlib/bits'];
for (const leaf of leaves) {
  const result = await runNodeEffect(resolve(absolute('fjs', leaf, 'module.f.mjs')));
  console.log(leaf, result[0] === 'ok' ? 'accepted' : JSON.stringify(result[1]));
}
```

After a compiler feature lands, rediscover the runtime dependency leaves,
compile every candidate, rename accepted modules and update their references,
then rediscover and repeat until a pass accepts none. Update this table with
the remaining refusals.

#### Leaf migration fixed point at `7baae35` (historical)

Measured on `7baae35`, `main` at
[#3100](https://github.com/functionalscript/functionalscript/pull/3100),
which admitted [elisions](../spec/bindings/destructuring/README.md). A leaf is as
defined in the `5dcd94b` audit below, and the leaves were rediscovered as
the `0c9ddf8` table below says: every authored non-proof module loaded
through Node with a resolve hook recording each runtime import.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 10 | The `sample` of `nanvm/demos/collatz`, `comma`, `hello` and `sort`, each accepted as written |
| 2 | 6 | None: every remaining leaf is refused as written |

The four samples are new since the `e9df9df` table below: the programs of
the NaNVM demo pages ([`todo/wasm-demos.md`](./wasm-demos.md)), each a
module that imports nothing. The compiler accepts each as written, so only
its name changes. The demos generator finds a sample by
[`samplePath`](../fjs/nanvm/demos/page/module.f.mjs), which names
`sample.f.js` now, and the Rust it compiles each into, in
`nanvm/demos/gen.samples`, is unchanged. Their references follow, 13 files
with the proofs, which stay `proof.f.mjs`.

The renames expose no leaf: each demo page that imports a sample imports
other `.f.mjs` modules too. The second pass checks the six leaves left,
against the same compiler, and converts none.

The authored `.f.js` population under `fjs/` grows from 43 to 47, and
`npm start compile` checks 64.

The `types/stack_walk` row is new, its module added since: its first
refusal was measured, and what stands behind it was read, not measured.
The other five rows are the `e9df9df` table's, measured again, unchanged.
Locations are `line:column`; paths are relative to `fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `git/config/module.f.mjs` | 379:41 | `acc.sub` in `subStep`, `sub` a `String.prototype` name (`prohibited property name`) | Nothing: the copy with `_SubState`'s `sub` renamed to a name no prototype gives a value, `part`, is accepted — `name` is no such name, `Function.prototype` giving it one |
| `types/stack_walk/module.f.mjs` | 43:9 | `let [acc, step] = …` in `walkFold`, a pattern where a loop's `let` takes a name | Read, not measured: a second `let`, `stack`; the tuple assignments `[acc, step] = …`; an `if … else if … else` whose branches `return` inside `while (true)`; the assignment to `stack`, not the loop's variable; and no `return` after `while (true)` |
| `types/function/compare/module.f.mjs` | 65:9 | `if (e < b) { return b }`, a `return` guard inside the loop in `bsearch` | In `bsearch`, a `switch` inside the loop whose cases assign `b` and `e` and end in `break`, no `return` after `while (true)`, and a second `let`, `e`, not the loop's variable |
| `types/list/module.f.mjs` | 51:9 | `if … else if` assigning to the parameter `head` inside the loop in `next` | In `next`, the tuple assignments, `continue`, `'head' in head`, two `return` guards inside the loop, the assignment to `head`, not the loop's variable, and no `return` after `while (true)`; `while` over a parameter, with no `let`, in `trampoline`; in `iterable`, the generator, `Symbol` and `yield`, a bare `return` guard inside the loop and no `return` after `while (true)`; in `last`, a `return` guard inside the loop and no `return` after `while (true)`; in `tryFold`, `for…of` and a `return` guard inside it; `'first' in notLazy` in `lengthList`; `const { from } = Array`, `Array` a reserved word there; nine forward references, each `…Step` to the export after it |
| `types/map/module.f.mjs` | 10:38 | `new` in `mapSet`, a reserved word (`reserved word`): its line's `Map(...)` reads as a call statement of its own, which the fold refuses after it | `new Map(...)` in `mapDelete`; `Map` is not a language type. Its one importer, `edag/analysis`, keys the map by EDAG nodes, objects compared by identity, so rule 9 does not apply |
| `zlib/bits/module.f.mjs` | 33:5 | The `for` loop in `read` | `let word`, with no `while` after it |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = [
  'git/config', 'types/stack_walk', 'types/function/compare', 'types/list',
  'types/map', 'zlib/bits',
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

#### Leaf migration fixed point at `e9df9df` (historical)

Measured on `e9df9df`, the head of
[#3097](https://github.com/functionalscript/functionalscript/pull/3097),
which implemented [call statements](../spec/functions/call-statements/README.md),
with `text/ascii` renamed. A leaf is as defined in the `5dcd94b` audit
below, and the leaves were rediscovered as the `0c9ddf8` table below says:
every authored non-proof module loaded through Node with a resolve hook
recording each runtime import.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 5 | `text/ascii`, by `'\u0000'` for `'\0'`, `undefined` for `void 0` and the rewrite of [rule 8](../doc/CONVERTING.md#8-bigint) |
| 2 | 5 | None: every remaining leaf is refused as written |

`text/ascii` held the refusals its row in the `2e0462e` table below lists,
and each has an admitted spelling. `nul` is `one('\u0000')`, the same
character. `at` compares its code point with `undefined`, the value
`void 0` is. `digitsValue` and `hexDigitsValue` convert each digit with
`bigint` from [`types/bigint/from_number`](../fjs/types/bigint/from_number/module.f.js),
which answers as `BigInt` does on the safe integers they pass (rule 8). The
`assert(…)` that opens `digitsValue` stays as written: it is a call
statement now. Its references follow, 35 files with its proof, which
stays `proof.f.mjs`.

The rename exposes one leaf, `git/config`, which imports `text/ascii`,
`types/object/entry`, `types/result` and `git/bytes`, all `.f.js` already.
`main`'s `9183a13`, merged in since, added the last and moved nothing in
the table. The second
pass checks it with the four leaves left, against the same compiler, and
converts none.

The authored `.f.js` population under `fjs/` grows from 42 to 43, and
`npm start compile` checks 60.

The `git/config` row moved once
[elisions](../spec/bindings/destructuring/README.md) landed, measured on that
pull request's branch: the hole in `const [, list] = …` in `tryEntries`,
its first refusal before, is read now. What remains was measured on a
scratch copy, each refusal replaced by the spelling the language admits
until the copy was accepted. The other four rows are the `2e0462e`
table's, their modules unchanged since. Locations are `line:column`;
paths are relative to `fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `git/config/module.f.mjs` | 379:41 | `acc.sub` in `subStep`, `sub` a `String.prototype` name (`prohibited property name`) | Nothing: the copy with `_SubState`'s `sub` renamed to a name no prototype gives a value, `part`, is accepted — `name` is no such name, `Function.prototype` giving it one |
| `types/function/compare/module.f.mjs` | 65:9 | `if (e < b) { return b }`, a `return` guard inside the loop in `bsearch` | In `bsearch`, a `switch` inside the loop whose cases assign `b` and `e` and end in `break`, no `return` after `while (true)`, and a second `let`, `e`, not the loop's variable |
| `types/list/module.f.mjs` | 51:9 | `if … else if` assigning to the parameter `head` inside the loop in `next` | In `next`, the tuple assignments, `continue`, `'head' in head`, two `return` guards inside the loop, the assignment to `head`, not the loop's variable, and no `return` after `while (true)`; `while` over a parameter, with no `let`, in `trampoline`; in `iterable`, the generator, `Symbol` and `yield`, a bare `return` guard inside the loop and no `return` after `while (true)`; in `last`, a `return` guard inside the loop and no `return` after `while (true)`; in `tryFold`, `for…of` and a `return` guard inside it; `'first' in notLazy` in `lengthList`; `const { from } = Array`, `Array` a reserved word there; nine forward references, each `…Step` to the export after it |
| `types/map/module.f.mjs` | 10:38 | `new` in `mapSet`, a reserved word (`reserved word`): its line's `Map(...)` reads as a call statement of its own, which the fold refuses after it | `new Map(...)` in `mapDelete`; `Map` is not a language type. Its one importer, `edag/analysis`, keys the map by EDAG nodes, objects compared by identity, so rule 9 does not apply |
| `zlib/bits/module.f.mjs` | 33:5 | The `for` loop in `read` | `let word`, with no `while` after it |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = ['git/config', 'types/function/compare', 'types/list', 'types/map', 'zlib/bits'];
for (const leaf of leaves) {
  const result = await runNodeEffect(resolve(absolute('fjs', leaf, 'module.f.mjs')));
  console.log(leaf, result[0] === 'ok' ? 'accepted' : JSON.stringify(result[1]));
}
```

After a compiler feature lands, rediscover the runtime dependency leaves,
compile every candidate, rename accepted modules and update their references,
then rediscover and repeat until a pass accepts none. Update this table with
the remaining refusals.

#### Leaf migration fixed point at `2e0462e` (historical)

Measured on `2e0462e`, the head of
[#3079](https://github.com/functionalscript/functionalscript/pull/3079),
which renamed `ebnf/ast` and `types/nullable`. A leaf is as defined in the
`5dcd94b` audit below, and the leaves were rediscovered as the `0c9ddf8`
table below says: every authored non-proof module loaded through Node with a
resolve hook recording each runtime import.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 6 | `ebnf/token_symbol`, by the rewrites of [rule 10](../doc/CONVERTING.md#10-a-call-made-for-its-failure), [rule 9](../doc/CONVERTING.md#9-a-map-or-a-set-of-strings) and [rule 1](../doc/CONVERTING.md#1-computed-keys) |
| 2 | 5 | None: every remaining leaf is refused as written |

`ebnf/token_symbol` held the refusals its row in the `2a5b9c7` table below
lists, and each has an admitted rewrite. Its two `assert(…)`
statements stood directly before a `return`, so each call moves into that
`return` as the comma's discarded operand and keeps its place in the order
(rule 10). The `new Set(names)` that asked whether a name repeats is the
question asked of the list itself,
`names.every((n, i) => names.indexOf(n) === i)`, which rule 9 now names
for a `Set` of strings. The key `names[symbol - start]` is
`names[Number(symbol - start)]`, the same number (rule 1). Its references
follow, six files, and its proof, which pins both refusals, stays
`proof.f.mjs`.

The rename exposes no leaf: every module importing `ebnf/token_symbol`
imports another `.f.mjs` too. The second pass checks the five leaves left,
against the same compiler, and converts none.

The authored `.f.js` population under `fjs/` grows from 41 to 42, and
`npm start compile` checks 59.

The five rows are the `2a5b9c7` table's, each first refusal measured again.
Three moved once [call statements](../spec/functions/call-statements/README.md)
landed, measured on that pull request's branch: `assert(…);` is a call
statement now, so the `assert` rows of `types/function/compare` and
`zlib/bits` are refused at what comes after; and `types/map` is refused at
its `new`, a reserved word, since the `Map(...)` after it on its line reads
as a call statement, which the fold refuses only after the `new`. No leaf
became convertible. Locations are `line:column`; paths are relative to
`fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `text/ascii/module.f.mjs` | 39:24 | `'\0'` in `nul`, an escape the language does not read (`lit.string-escape`; `'\u0000'` is the admitted spelling) | `void 0` in `at` (`op.void`); `BigInt(…)` in `digitsValue` and `hexDigitsValue`, `const not found` ([rule 8](../doc/CONVERTING.md#8-bigint)) |
| `types/function/compare/module.f.mjs` | 65:9 | `if (e < b) { return b }`, a `return` guard inside the loop in `bsearch` | In `bsearch`, a `switch` inside the loop whose cases assign `b` and `e` and end in `break`, no `return` after `while (true)`, and a second `let`, `e`, not the loop's variable |
| `types/list/module.f.mjs` | 51:9 | `if … else if` assigning to the parameter `head` inside the loop in `next` | In `next`, the tuple assignments, `continue`, `'head' in head`, two `return` guards inside the loop, the assignment to `head`, not the loop's variable, and no `return` after `while (true)`; `while` over a parameter, with no `let`, in `trampoline`; in `iterable`, the generator, `Symbol` and `yield`, a bare `return` guard inside the loop and no `return` after `while (true)`; in `last`, a `return` guard inside the loop and no `return` after `while (true)`; in `tryFold`, `for…of` and a `return` guard inside it; `'first' in notLazy` in `lengthList`; `const { from } = Array`, `Array` a reserved word there; nine forward references, each `…Step` to the export after it |
| `types/map/module.f.mjs` | 10:38 | `new` in `mapSet`, a reserved word (`reserved word`): its line's `Map(...)` reads as a call statement of its own, which the fold refuses after it | `new Map(...)` in `mapDelete`; `Map` is not a language type. Its one importer, `edag/analysis`, keys the map by EDAG nodes, objects compared by identity, so rule 9 does not apply |
| `zlib/bits/module.f.mjs` | 33:5 | The `for` loop in `read` | `let word`, with no `while` after it |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = ['text/ascii', 'types/function/compare', 'types/list', 'types/map', 'zlib/bits'];
for (const leaf of leaves) {
  const result = await runNodeEffect(resolve(absolute('fjs', leaf, 'module.f.mjs')));
  console.log(leaf, result[0] === 'ok' ? 'accepted' : JSON.stringify(result[1]));
}
```

After a compiler feature lands, rediscover the runtime dependency leaves,
compile every candidate, rename accepted modules and update their references,
then rediscover and repeat until a pass accepts none. Update this table with
the remaining refusals.

#### Leaf migration fixed point at `2a5b9c7` (historical)

Measured on `2a5b9c7`, the head of
[#3077](https://github.com/functionalscript/functionalscript/pull/3077),
which renamed `asserts`, with `main` merged in. A leaf is as defined in the
`5dcd94b` audit below, and the leaves were rediscovered as the `0c9ddf8`
table below says: every authored non-proof module loaded through Node with a
resolve hook recording each runtime import.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 7 | `ebnf/ast`, `types/nullable`, by the rewrite of [rule 10](../doc/CONVERTING.md#10-a-call-made-for-its-failure) |
| 2 | 6 | None: every remaining leaf is refused as written |

The seven leaves are the `265b4a7` table's, each first refused where that
table says. `ebnf/ast` held four refusals and `types/nullable` one, each an
`assert(…)` written directly before a `return`, so each call moves into
that `return` as the comma's discarded operand and keeps its place in the
order. Nothing else changes in either module. Their references follow:
`ebnf/ast` is named in 11 files and its README, `types/nullable` in 21
files, and each proof stays `proof.f.mjs`.

The renames expose one leaf, `ebnf/token_symbol`, which imports
`types/nullable` and `asserts` alone. The second pass checks it with the
five leaves left, against the same compiler, and converts none.

The authored `.f.js` population under `fjs/` grows from 39 to 41, and
`npm start compile` checks 58.

The `text/ascii` row was measured again: its module has grown since the
`265b4a7` table, and the same rewrites carry it to acceptance, so the row
is unchanged. The `types/function/compare`, `types/list`, `types/map` and
`zlib/bits` rows are the `265b4a7` table's: of those modules, only the
path of an `asserts` import has changed since. The `ebnf/token_symbol` row
was measured as the others were: each refusal was removed on a scratch
copy, in turn, or replaced by the spelling the language admits for it,
until the copy was accepted, so a construct is listed only where the
compiler reported it. Locations are `line:column`; paths are relative to
`fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `ebnf/token_symbol/module.f.mjs` | 48:5 | `assert(…)` as a statement in `encoding`, before its `return` | `new Set(names)` in that assertion, `Set` not a language type; `assert(…)` as a statement in `encode`, before its `return`; `names[symbol - start]` in `decode`, `computed key is not Number(...)` ([rule 1](../doc/CONVERTING.md#1-computed-keys)) |
| `text/ascii/module.f.mjs` | 39:24 | `'\0'` in `nul`, an escape the language does not read (`lit.string-escape`; `'\u0000'` is the admitted spelling) | `void 0` in `at` (`op.void`); `assert(…)` as a statement in `digitsValue`, before its `const`s; `BigInt(…)` in `digitsValue` and `hexDigitsValue`, `const not found` ([rule 8](../doc/CONVERTING.md#8-bigint)) |
| `types/function/compare/module.f.mjs` | 15:5 | `assert(…)` as a statement in `index3` | The same in `index5`; in `bsearch`, a `return` guard inside the loop, a `switch` inside the loop whose cases assign `b` and `e` and end in `break`, no `return` after `while (true)`, and a second `let`, `e`, not the loop's variable |
| `types/list/module.f.mjs` | 51:9 | `if … else if` assigning to the parameter `head` inside the loop in `next` | In `next`, the tuple assignments, `continue`, `'head' in head`, two `return` guards inside the loop, the assignment to `head`, not the loop's variable, and no `return` after `while (true)`; `while` over a parameter, with no `let`, in `trampoline`; in `iterable`, the generator, `Symbol` and `yield`, a bare `return` guard inside the loop and no `return` after `while (true)`; in `last`, a `return` guard inside the loop and no `return` after `while (true)`; in `tryFold`, `for…of` and a `return` guard inside it; `'first' in notLazy` in `lengthList`; `const { from } = Array`, `Array` a reserved word there; nine forward references, each `…Step` to the export after it |
| `types/map/module.f.mjs` | 10:42 | `new Map(...)` in `mapSet` | `new Map(...)` in `mapDelete`; `Map` is not a language type. Its one importer, `edag/analysis`, keys the map by EDAG nodes, objects compared by identity, so rule 9 does not apply |
| `zlib/bits/module.f.mjs` | 25:5 | `assert(…)` as a statement in `read`, before its guards | The `for` loop in `read`; `let word`, with no `while` after it |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = [
  'ebnf/token_symbol', 'text/ascii', 'types/function/compare', 'types/list',
  'types/map', 'zlib/bits',
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

#### Leaf migration fixed point at `265b4a7` (historical)

Measured on `265b4a7`, the head of
[#3075](https://github.com/functionalscript/functionalscript/pull/3075),
which added the comma operator. A leaf is as defined in the `5dcd94b` audit
below, and the leaves were rediscovered as the `0c9ddf8` table below says:
every authored non-proof module loaded through Node with a resolve hook
recording each runtime import.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 3 | `asserts`, by the rewrites of [rule 10](../doc/CONVERTING.md#10-a-call-made-for-its-failure) and [rule 7](../doc/CONVERTING.md#7-a-body-that-ends-without-return) |
| 2 | 8 | `js/members` |
| 3 | 7 | None: every remaining leaf is refused as written |

`asserts` held the refusals the `122820b` row below lists, and each has an
admitted rewrite now. `assert` braces its guard and returns `undefined`
after it (rule 7). `assertEq` and `assertStructurallySame` return the call
of `assert`, which returns `undefined` as the two did. `assertNotNullish`,
`assertOk` and `assertError` return the comma of the call and the value
(rule 10), which `tsc` still narrows, since TypeScript follows an `asserts`
call through a comma's discarded operand. Its proof gains the cases of
`assertNotNullish` it lacked, and stays `proof.f.mjs`. Its references are
414 files: the import in every module and proof that asserts, and seven
documents.

The rename exposes six leaves, each importing no other `.f.mjs`: `ebnf/ast`, `js/members`, `text/ascii`, `types/function/compare`,
`types/nullable` and `zlib/bits`. `js/members` was refused only inside
`asserts`, and compiles whole with its extension and its references
changed: its proof and its `types.ts`, no module importing it. The third
pass checks the seven leaves left, against the same compiler, and converts
none as written. Two compile whole with rule 10 alone: `ebnf/ast`, whose
four refusals are each an `assert(…)` before a `return`, and
`types/nullable`, whose one is. They are the next conversions.

The authored `.f.js` population under `fjs/` grows from 37 to 39, and
`npm start compile` checks 56.

The `types/list` and `types/map` rows are the `122820b` table's,
unchanged: neither module has changed since, and each first refusal was
measured again and is the same. The five new rows were measured as the
others were: each refusal was removed on a scratch copy, in turn, or
replaced by the spelling the language admits for it, until the copy was
accepted, so a construct is listed only where the compiler reported it.
Locations are `line:column`; paths are relative to `fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `ebnf/ast/module.f.mjs` | 30:5 | `assert(…)` as a statement in `unmapped` | The same before the `return` of `items`, `variant` and `symbolAt`; rule 10 rewrites all four, and the module then compiles whole |
| `text/ascii/module.f.mjs` | 39:24 | `'\0'` in `nul`, an escape the language does not read (`lit.string-escape`; `'\u0000'` is the admitted spelling) | `void 0` in `at` (`op.void`); `assert(…)` as a statement in `digitsValue`, before its `const`s; `BigInt(…)` in `digitsValue` and `hexDigitsValue`, `const not found` ([rule 8](../doc/CONVERTING.md#8-bigint)) |
| `types/function/compare/module.f.mjs` | 15:5 | `assert(…)` as a statement in `index3` | The same in `index5`; in `bsearch`, a `return` guard inside the loop, a `switch` inside the loop whose cases assign `b` and `e` and end in `break`, no `return` after `while (true)`, and a second `let`, `e`, not the loop's variable |
| `types/list/module.f.mjs` | 51:9 | `if … else if` assigning to the parameter `head` inside the loop in `next` | In `next`, the tuple assignments, `continue`, `'head' in head`, two `return` guards inside the loop, the assignment to `head`, not the loop's variable, and no `return` after `while (true)`; `while` over a parameter, with no `let`, in `trampoline`; in `iterable`, the generator, `Symbol` and `yield`, a bare `return` guard inside the loop and no `return` after `while (true)`; in `last`, a `return` guard inside the loop and no `return` after `while (true)`; in `tryFold`, `for…of` and a `return` guard inside it; `'first' in notLazy` in `lengthList`; `const { from } = Array`, `Array` a reserved word there; nine forward references, each `…Step` to the export after it |
| `types/map/module.f.mjs` | 10:42 | `new Map(...)` in `mapSet` | `new Map(...)` in `mapDelete`; `Map` is not a language type. Its one importer, `edag/analysis`, keys the map by EDAG nodes, objects compared by identity, so rule 9 does not apply |
| `types/nullable/module.f.mjs` | 61:5 | `assert(…)` as a statement in `unwrap` | Nothing: the one refusal, which rule 10 rewrites |
| `zlib/bits/module.f.mjs` | 25:5 | `assert(…)` as a statement in `read`, before its guards | The `for` loop in `read`; `let word`, with no `while` after it |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = [
  'ebnf/ast', 'text/ascii', 'types/function/compare', 'types/list',
  'types/map', 'types/nullable', 'zlib/bits',
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

#### Leaf migration fixed point at `122820b` (historical)

Measured on `122820b`, the head of `main` after
[#3062](https://github.com/functionalscript/functionalscript/pull/3062)
renamed `website/issue`. A leaf is as defined in the `5dcd94b` audit below,
and the leaves were rediscovered as the `0c9ddf8` table below says: every
authored non-proof module loaded through Node with a resolve hook recording
each runtime import.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 3 | `types/object/structurally_same`, by one admitted rewrite |
| 2 | 3 | None: every remaining leaf is refused |

`types/object/structurally_same` held one refusal, not the two the
`999164a` row below claimed: `new Map(entries(b))`. The `Map` was a lookup
of `b`'s own entries by string key, and
[`types/object/entry`](../fjs/types/object/entry/module.f.js)'s `hasEntry`
and `entry` read the same entries, so the rewrite is
[CONVERTING.md rule 9](../doc/CONVERTING.md#9-a-map-or-a-set-of-strings),
added with it: a `Map` stays only where its keys are not strings.
`entry` imports nothing, so the module still imports nothing that reaches
`fjs/asserts`, and the cycle its README describes stays closed. Its
importers are `asserts` and `types/object`, which re-exports it, and the
`nanvm` and `nanvm/corpus` proofs; its own proof stays `proof.f.mjs`.

The rename exposes one leaf, `asserts`, whose only runtime import is
`structurally_same`. `types/object` still imports `.f.mjs` modules,
`types/list` and `types/nullable` among them. The second pass checks
`asserts` with the two leaves the first left, against the same compiler,
and converts none.

The authored `.f.js` population under `fjs/` grows from 36 to 37, and
`npm start compile` checks 54.

The `types/list` and `types/map` rows are the `999164a` table's,
unchanged: neither module has changed since, and each first refusal was
measured again and is the same. The `asserts` row was measured as the
others were: each refusal was removed on a scratch copy, in turn, until the
copy was accepted. Locations are `line:column`; paths are relative to
`fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `asserts/module.f.mjs` | 26:13 | `throw` as the body of an `if` without braces, in `assert` | In `assert`, no `return` after the guard ([rule 7](../doc/CONVERTING.md#7-a-body-that-ends-without-return)); the call `assert(…)` as a statement, last in `assertEq` and `assertStructurallySame`, and before the `return` in `assertNotNullish`, `assertOk` and `assertError`: a body holds only `const`s and guards before its terminating statement ([bodies and guards](../spec/control-flow/guards/README.md)) |
| `types/list/module.f.mjs` | 51:9 | `if … else if` assigning to the parameter `head` inside the loop in `next` | In `next`, the tuple assignments, `continue`, `'head' in head`, two `return` guards inside the loop, the assignment to `head`, not the loop's variable, and no `return` after `while (true)`; `while` over a parameter, with no `let`, in `trampoline`; in `iterable`, the generator, `Symbol` and `yield`, a bare `return` guard inside the loop and no `return` after `while (true)`; in `last`, a `return` guard inside the loop and no `return` after `while (true)`; in `tryFold`, `for…of` and a `return` guard inside it; `'first' in notLazy` in `lengthList`; `const { from } = Array`, `Array` a reserved word there; nine forward references, each `…Step` to the export after it |
| `types/map/module.f.mjs` | 10:42 | `new Map(...)` in `mapSet` | `new Map(...)` in `mapDelete`; `Map` is not a language type. Its one importer, `edag/analysis`, keys the map by EDAG nodes, objects compared by identity, so rule 9 does not apply |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = ['asserts', 'types/list', 'types/map'];
for (const leaf of leaves) {
  const result = await runNodeEffect(resolve(absolute('fjs', leaf, 'module.f.mjs')));
  console.log(leaf, result[0] === 'ok' ? 'accepted' : JSON.stringify(result[1]));
}
```

After a compiler feature lands, rediscover the runtime dependency leaves,
compile every candidate, rename accepted modules and update their references,
then rediscover and repeat until a pass accepts none. Update this table with
the remaining refusals.

#### Leaf migration fixed point at `999164a` (historical)

Measured at `999164a`, the head of `main` after
[#3056](https://github.com/functionalscript/functionalscript/pull/3056)
made the runtime value two functions. A leaf is as defined in the
`5dcd94b` audit below, and the leaves were rediscovered as the `0c9ddf8`
table below says: every authored non-proof module loaded through Node with a
resolve hook recording each runtime import.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 4 | `website/issue` |
| 2 | 3 | None: every remaining leaf is refused |

There are four leaves where the `3e1d1a09` table left three, because one
leaf is new. `website/issue`, added by
[#3022](https://github.com/functionalscript/functionalscript/pull/3022) to
show every issue's status and priority, imports only `types/result`, an
`.f.js`, and compiles whole.

It is converted with only its extension and its references changed, and
its proof stays `proof.f.mjs`. Its two importers are `website` and
`website/page`; its `types.ts` imports the type of `priorities` and
`statuses` from it, its demo and proof import it, and it is linked from
[`fjs/website/README.md`](../fjs/website/README.md) and
[`todo/README.md`](./README.md#issue-format). Both importers and the demo
still import other `.f.mjs` modules, `media/html`, `path` and
`website/demo` among them, so the rename exposes no new leaf. The nearest
is still `nanvm/methods`, which waits on `media/rust` alone, and
`media/rust` waits on `types/list` and `text/utf16`. The second pass checks
the three leaves the first refused, against the same compiler, and converts
none.

The authored `.f.js` population under `fjs/` grows from 35 to 36, and
`npm start compile` checks 53: those 36, the specification's six DataJS
vectors, and its eleven per-area example modules. It is 35, not the 34 the
`3e1d1a09` text counted, because `js/intrinsic` was added as an `.f.js`
([#3048](https://github.com/functionalscript/functionalscript/pull/3048))
and `text/shell` renamed to one
([#2991](https://github.com/functionalscript/functionalscript/pull/2991))
since.

The three remaining rows are the `3e1d1a09` table's: none of the three
modules had changed since, and each first refusal was measured again at
this head and was the same. The last column was copied from that table,
not measured again, and its `structurally_same` cell was wrong; it is
corrected below.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `types/list/module.f.mjs` | 51:9 | `if … else if` assigning to the parameter `head` inside the loop in `next` | In `next`, the tuple assignments, `continue`, `'head' in head`, two `return` guards inside the loop, the assignment to `head`, not the loop's variable, and no `return` after `while (true)`; `while` over a parameter, with no `let`, in `trampoline`; in `iterable`, the generator, `Symbol` and `yield`, a bare `return` guard inside the loop and no `return` after `while (true)`; in `last`, a `return` guard inside the loop and no `return` after `while (true)`; in `tryFold`, `for…of` and a `return` guard inside it; `'first' in notLazy` in `lengthList`; `const { from } = Array`, `Array` a reserved word there; nine forward references, each `…Step` to the export after it |
| `types/map/module.f.mjs` | 10:42 | `new Map(...)` in `mapSet` | `new Map(...)` in `mapDelete`; `Map` is not a language type |
| `types/object/structurally_same/module.f.mjs` | 56:20 | `new Map(entries(b))` in `structurallySame` | Nothing: the one refusal. This cell first claimed `const { entries } = Object` was refused too, copied from the `3e1d1a09` row without being measured again; `Object.entries` has been admitted in both spellings since the `0c9ddf8` table ([CONVERTING.md rule 6](../doc/CONVERTING.md#6-objectis-and-objectentries)), and the module converted once its `Map` was replaced |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = ['types/list', 'types/map', 'types/object/structurally_same'];
for (const leaf of leaves) {
  const result = await runNodeEffect(resolve(absolute('fjs', leaf, 'module.f.mjs')));
  console.log(leaf, result[0] === 'ok' ? 'accepted' : JSON.stringify(result[1]));
}
```

After a compiler feature lands, rediscover the runtime dependency leaves,
compile every candidate, rename accepted modules and update their references,
then rediscover and repeat until a pass accepts none. Update this table with
the remaining refusals.

#### Leaf migration fixed point at `3e1d1a09` (historical)

Measured at `3e1d1a09`, the head of `main` after
[#2980](https://github.com/functionalscript/functionalscript/pull/2980)
converted the specification into a tree of pages. A leaf is as defined in
the `5dcd94b` audit below, and the leaves were rediscovered as the `0c9ddf8`
table below says: every authored non-proof module loaded through Node with a
resolve hook recording each runtime import.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 5 | `media/rust/item`, `website/demo/code` |
| 2 | 3 | None: every remaining leaf is refused |

There are five leaves where the `0c9ddf8` table left six, because two of
its rows are no longer leaves and one leaf is new. `nanvm/methods` imports
`media/rust`'s `stringLiteral` since
[#2951](https://github.com/functionalscript/functionalscript/pull/2951), and
`website/browser-source` imports `path/import`'s `specifierKind` since
[#2954](https://github.com/functionalscript/functionalscript/pull/2954):
each now waits on an `.f.mjs` it imports, whatever it refuses itself.
`media/rust/item`, split out of the Rust generators in #2951, imports only
`types/result`, an `.f.js`, and compiles whole. `website/demo/code`
compiles whole since
[#2963](https://github.com/functionalscript/functionalscript/pull/2963)
admitted default parameters
([spec: parameters](../spec/functions/parameters/README.md)), its one refusal.

Both are converted with only their extension and their references changed,
and each proof stays `proof.f.mjs`. `media/rust/item`'s six importers are
`compiler/rust`, `edag/rust`, `nanvm/commands`, `nanvm/harness`,
`nanvm/methods` and `nanvm/rust`, and it is linked from `media/rust` and
from `edag/rust`'s
[prepared Rust binding contract](../fjs/rust/serializer/README.md).
`website/demo/code`'s nine importers are the `compiler`, `crypto/hmac`,
`crypto/pow`, `crypto/secp`, `crypto/sign` and `crypto/vdf` demos,
`website/cli`, `website/demo/hash` and `website/demo/highlight`, and it is
linked from [`fjs/website/README.md`](../fjs/website/README.md), the
[computed-property-key `todo/`](../fjs/compiler/todo/computed-property-key.md)
and the
[default-parameters proposal](../spec/todo/3125-default-parameters.md),
whose task to convert it and rerun this migration is ticked.

Every importer of the two still imports another `.f.mjs`, so neither rename
exposes a new leaf. The nearest is `nanvm/methods`, which now waits on
`media/rust` alone, and `media/rust` waits on `types/list` and `text/utf16`.
The second pass checks the three leaves the first refused, against the same
compiler, and converts none.

The authored `.f.js` population under `fjs/` grows from 32 to 34, and
`npm start compile` checks 51: those 34, the specification's six DataJS
vectors, and the eleven per-area example modules #2980 added under `spec/`.

The three remaining rows were measured again on scratch copies at this
head. `types/map` and `types/object/structurally_same` are unchanged.
`types/list` adds what the `0c9ddf8` row did not reach behind a construct it
had removed whole: in `iterable`, a bare `return` guard inside the loop and
the body that ends at `while (true)`, behind the generator; in `last`, the
body that ends at `while (true)`, behind its guard; and in `tryFold`, a
`return` guard inside the `for…of`.

Each row is the first actual refusal from the `resolve()` pipeline, and
the last column what else the compiler does not accept in the module. The
last column was measured, not read: each refusal was removed on a scratch
copy, in turn, until the copy was accepted, so a construct is listed only
where the compiler reported it. Locations are `line:column`; paths are
relative to `fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `types/list/module.f.mjs` | 51:9 | `if … else if` assigning to the parameter `head` inside the loop in `next` | In `next`, the tuple assignments, `continue`, `'head' in head`, two `return` guards inside the loop, the assignment to `head`, not the loop's variable, and no `return` after `while (true)`; `while` over a parameter, with no `let`, in `trampoline`; in `iterable`, the generator, `Symbol` and `yield`, a bare `return` guard inside the loop and no `return` after `while (true)`; in `last`, a `return` guard inside the loop and no `return` after `while (true)`; in `tryFold`, `for…of` and a `return` guard inside it; `'first' in notLazy` in `lengthList`; `const { from } = Array`, `Array` a reserved word there; nine forward references, each `…Step` to the export after it |
| `types/map/module.f.mjs` | 10:42 | `new Map(...)` in `mapSet` | `new Map(...)` in `mapDelete`; `Map` is not a language type |
| `types/object/structurally_same/module.f.mjs` | 56:20 | `new Map(entries(b))` in `structurallySame` | `const { entries } = Object`: `entries` is a prohibited property name, `Array.prototype`'s, and spelled `Object.entries` it is refused at `Object`, whose one admitted member is `is`; the language enumerates no keys |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = ['types/list', 'types/map', 'types/object/structurally_same'];
for (const leaf of leaves) {
  const result = await runNodeEffect(resolve(absolute('fjs', leaf, 'module.f.mjs')));
  console.log(leaf, result[0] === 'ok' ? 'accepted' : JSON.stringify(result[1]));
}
```

After a compiler feature lands, rediscover the runtime dependency leaves,
compile every candidate, rename accepted modules and update their references,
then rediscover and repeat until a pass accepts none. Update this table with
the remaining refusals.

#### Leaf migration fixed point at `0c9ddf8` (historical)

Measured at `0c9ddf8`, the head of `main` at the 0.56.0 release. A leaf is
as defined in the `5dcd94b` audit below, and the embedded-proof fixture is
`example.f.js`, converted, so there is none to report separately. The leaves
were rediscovered by loading every authored non-proof module through Node
with a resolve hook recording each runtime import, so a JSDoc `@import` is
never one.

| Pass | Implementation leaves checked | Converted to `.f.js` |
| --- | ---: | --- |
| 1 | 7 | `git/refstore/scope` |
| 2 | 0 | None: no `.f.mjs` waits on `git/refstore/scope` alone |

There are seven leaves where the `e40fa58` table below left ten, because
four of its rows are no longer leaves and one leaf is new. `ci/package` and
`types/ts` import `js/string_escape`'s quoted-string writer since
[#2902](https://github.com/functionalscript/functionalscript/pull/2902),
`types/ts` `types/bigint`'s `serialize` besides, `git/config` imports
`text/ascii`'s digit runs since
[#2938](https://github.com/functionalscript/functionalscript/pull/2938), and
`media/rust` imports `types/list` and `text/utf16` since
[#2892](https://github.com/functionalscript/functionalscript/pull/2892): each
now waits on an `.f.mjs` it imports, whatever it refuses itself.
`git/refstore/scope`, split out of `git/refstore` in
[#2907](https://github.com/functionalscript/functionalscript/pull/2907),
imports nothing at run time and compiles whole, so it is converted with only
its extension and its references changed: its two importers,
`git/refstore` and `git/refstore/write`, its proof, which stays
`proof.f.mjs`, and the links to it from `git/refstore/name` and
[`fjs/js/identifier`'s lexical-predicates `todo/`](../fjs/js/identifier/todo/lexical-predicates-from-text-ascii.md).
Both importers import other `.f.mjs` modules, so the rename exposes no new
leaf and the second pass has nothing to check.

The authored `.f.js` population under `fjs/` grows from 31 to 32, and
`npm start compile` checks 38 with the specification's vectors. It is 31,
not the 34 the `e40fa58` text counted, because `js/runtime` and `js/static`
were added as `.f.js` since, and
[#2936](https://github.com/functionalscript/functionalscript/pull/2936)
deleted five: `types/number/is_finite`, `is_integer`, `is_nan`,
`is_safe_integer` and `types/object/is`, whose bodies moved into the
runtime.

`nanvm/methods` and `website/demo/code` still hold one refusal each.
`types/object/structurally_same` calls `Object.is` now, in place of the
deleted `types/object/is`, and the compiler accepts the call; its first
refusal is the one before. Behind it, the `e40fa58` row read the `Object`
global as the prohibited property name in `const { entries } = Object`; the
compiler then named the key, `entries`, which a pattern refused before it
read the namespace. Since `Object.entries` was admitted
([2360](../spec/todo/2360-built-in.md#objectentries-proposal-and-approval)),
the namespace's list decides first, and a copy with `new Map` replaced
compiles whole, measured after the table's commit.
`types/list` adds what the earlier row did not reach in `next`: its two
`return` guards inside the loop and the body that ends at `while (true)`.

Each row is the first actual refusal from the `resolve()` pipeline, and
the last column what else the compiler does not accept in the module. The
last column was measured, not read: each refusal was removed on a scratch
copy, in turn, until the copy was accepted, so a construct is listed only
where the compiler reported it. Locations are `line:column`; paths are
relative to `fjs/`.

| Leaf file | Location | First refused construct | Behind it |
| --- | ---: | --- | --- |
| `nanvm/methods/module.f.mjs` | 115:20 | `Object.values` in `rows` | Nothing: the one refusal |
| `types/list/module.f.mjs` | 51:9 | `if … else if` assigning to the parameter `head` inside the loop in `next` | In `next`, the tuple assignments, `continue`, `'head' in head`, two `return` guards inside the loop, the assignment to `head`, not the loop's variable, and no `return` after `while (true)`; `while` over a parameter, with no `let`, in `trampoline`; the generator, `Symbol` and `yield` in `iterable`; a `return` guard inside the loop in `last`; `for…of` in `tryFold`; `'first' in notLazy` in `lengthList`; `const { from } = Array`, `Array` a reserved word there; nine forward references, each `…Step` to the export after it |
| `types/map/module.f.mjs` | 10:42 | `new Map(...)` in `mapSet` | `new Map(...)` in `mapDelete`; `Map` is not a language type |
| `types/object/structurally_same/module.f.mjs` | 56:20 | `new Map(entries(b))` in `structurallySame` | Nothing: the one refusal, since `Object.entries` is admitted, `const { entries } = Object` with it |
| `website/browser-source/module.f.mjs` | 63:9 | Guard with `break` inside the loop in `read` | All in `read`: two loop variables and a `let` inside the loop, `continue`, `+=`, nested loops, and an `if` whose body neither returns nor throws |
| `website/demo/code/module.f.mjs` | 12:48 | Default parameter in `codeBlock` | Nothing: the one refusal |

To recheck the current table without writing generated output, run this from
the repository root inside `./dev.sh node --input-type=module`:

```js
import { resolve as absolute } from 'node:path';
import { resolve } from './fjs/compiler/edag/module.f.mjs';
import { runNodeEffect } from './fjs/effects/node/module.mjs';

const leaves = [
  'nanvm/methods', 'types/list', 'types/map',
  'types/object/structurally_same', 'website/browser-source',
  'website/demo/code',
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

#### Leaf migration fixed point at `e40fa58` (historical)

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
([reading an entry at run time](../spec/property-access/entries/README.md),
[property access](../spec/property-access/README.md)). That is not a rewrite
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

The table above is a historical measurement. `array_index` now calls
`Number.isInteger`, admitted as a static function
([spec: built-in static functions](../spec/built-ins/static-functions/README.md)),
in place of the shared helper it once imported. Its bounds and canonical
string round-trip are unchanged. With
[`String` conversion](../spec/conversions/string/README.md) admitted,
`array_index` now compiles through the predicate and its canonical string
check; the rename above completes that migration step. `types/number`,
ASCII digit parsing, Unicode surrogate conversion, and Node/web validation
call the same built-in.

Compared with the previous measurement at `4c8ec55`, the `08d013b` snapshot
had the same eighteen leaves and compiler progress on three of them.
`Number(exp)` is in the language and `Number` a reserved word
([number conversion](../spec/conversions/number/README.md)), so
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
([`instanceof`](../spec/operators/instanceof/README.md)). Two leaves changed their
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
| Template literals | now implemented ([spec: template literals](../spec/values/template-literals/README.md)) | function/operator, ci/package, ts, nanvm/methods, nanvm/member, style, demo/code, git/config, browser-source |
| Destructuring | [`spec/todo/2450-destructuring.md`](../spec/todo/2450-destructuring.md) | structurally_same, result, function/operator, map, demo/examples, ts, git/config, nanvm/methods |
| A runtime key that is a string, `a[k]` | in the language as the `entry` helper ([spec: entry](../spec/property-access/entries/README.md)); the module rewrites `a[k]` as `entry(a, k)`, and `k in a` as `hasEntry(a, k)`, both imported from [`fjs/types/object/entry`](../fjs/types/object/entry/module.f.js) | git/config, nanvm/methods |
| A runtime key that is a number, `a[i]` | in the language as the conversion `a[Number(i)]` ([spec: property access](../spec/property-access/README.md)), the EDAG's `['.', a, ['Number', i]]`; the module rewrites `a[i]` as `a[Number(i)]`, not `entry` | structurally_same, function/operator, set, git/bytes, git/config, browser-source |
| Globals and built-ins | [`spec/todo/2365-global-names.md`](../spec/todo/2365-global-names.md), [`2360-built-in.md`](../spec/todo/2360-built-in.md); of `Number`, the call `Number(exp)` is in the language ([spec: number conversion](../spec/conversions/number/README.md)), and so are the four predicates `Number.isInteger`, `Number.isSafeInteger`, `Number.isNaN` and `Number.isFinite`, with `Object.is` ([spec: built-in static functions](../spec/built-ins/static-functions/README.md)), each other member an admission of its own | structurally_same, array_index, ts, git/bytes, nanvm/methods, ci/package, git/config |
| `new` with a built-in constructor | nothing proposes it; `Map` and `Set` are undecided in [`2360-built-in.md`](../spec/todo/2360-built-in.md) | structurally_same, keywords, map, set, demo/examples |
| `let`, reassignment, `+=`, `while` | [variables](../spec/bindings/variables/README.md) and [loops](../spec/control-flow/loops/README.md); `+=` is [`3430-assignments.md`](../spec/todo/3430-assignments.md); `while` is [roadmap §3.2](../spec/todo/README.md#32-priority-2) | function, set, browser-source |
| String escapes `\u{…}`, `\v`, `\0` | [`spec/todo/2460-js-string-literals.md`](../spec/todo/2460-js-string-literals.md) | nanvm/member, demo/code, git/config |
| A non-terminating `if`, `break`, `continue` | [roadmap §3.2](../spec/todo/README.md#32-priority-2), the guard's follow-ups; `break` and `continue` are `while`'s | set, browser-source |
| `for … of` | nothing proposes it | result |
| `switch`, a default parameter | neither proposed; [`3120-parameters.md`](../spec/todo/3120-parameters.md) leaves a default parameter for later | ts |
| A prohibited member function, `toLowerCase`, or property name, `sub` | `toLowerCase` is now admitted ([spec: built-in member functions](../spec/built-ins/member-functions/README.md)); `sub` stays a prohibited property name, [`fjs/js/prototype`](../fjs/js/prototype/module.f.js)'s `prototypeNames` ([spec: property access](../spec/property-access/README.md)), and the module rewrites it, not the language | git/config |

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
([objects](../spec/values/objects/README.md)) — the one rename no language step
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
`442ea8f`: of 325 modules — 279 `module.f.mjs` and 46 `module.f.js`
— the 46 `.f.js` compile and every `.f.mjs` stops at its first refusal. The
table counts that first refusal only, read at the token the compiler names,
so it says which feature to settle first, not how much each costs; a refusal
the compiler meets in an import is counted under the import's feature, 65 of
the rows' members.

| Modules | First refusal |
| ---: | --- |
| 43 | `for`, `for…of` ([3270](../spec/todo/3270-for.md)) |
| 35 | a computed member, `a[i]`, its key not `Number(…)` |
| 34 | a general loop: an `if` with `return`, `break` or `continue` inside a `while`, a nested `while`, a second variable the loop assigns ([implemented loop integration](../fjs/compiler/architecture.md#loop-integration); historical refusal at this snapshot) |
| 27 | a global name: `Object`, `Array`, `String`, `BigInt`, `JSON`, `Math`, `Boolean`, `parseFloat`, `encodeURIComponent` ([2360](../spec/todo/2360-built-in.md), [2365](../spec/todo/2365-global-names.md)) |
| 26 | a block whose end is reachable: a body of calls with no `return` (`assert(…)`), an `if` with no terminator, `else` among them, a `switch` with no `default` or with `break` ([3210](../spec/todo/3210-reachable-block-end.md), [3230](../spec/todo/3230-switch.md)) |
| 19 | a property name a prototype owns: `name` 12 times, `concat`, `reduce`, `sub`, `push`, `with` |
| 18 | a read of a later `const` ([3140](../spec/todo/3140-forward-references.md)) |
| 17 | `export { … }`, with and without `from` |
| 15 | `new Map`, `new Set` |
| 10 | `in` |
| 9 | an escape the tokenizer refuses, `'\0'`, `'\x1b'` |
| 6 | a rest element in a pattern, `[a, ...rest]` |
| 5 | a compound assignment, `+=`, `-=`, `>>=`, `<<=` |
| 5 | a `case` or `if` body without braces |
| 4 | a default in a pattern, `{ x = 1 }` |
| 3 | a numeric key in an object literal, `{ 0: … }` |
| 3 | one each: `import * as`, unary `+`, an assignment to a pattern |

At `4c8ec55` the table was over 228 modules, 6 of them `.f.js`, with template
literals the first refusal of 94 and destructuring of 47. Both have landed
since — templates entirely, destructuring but for the rest element and
defaults — and loops lead now: `for` and the general loop, 77 between them.
At `55d1204` it was 317 modules, 45 of them `.f.js`. Ten modules were added
since and two removed, `ci/dev` and `ci/nix`; no module changed between
compiling and refused, and the one `.f.js` among the added is the whole gain.
The leaf table above is what this count does not say: a module whose first
refusal clears meets its next, and only a leaf whose every feature has landed
renames. The same count over the self-hosting loader's dependencies is in
[the MVP roadmap](../nanvm/lib/todo/mvp-roadmap.md#where-self-hosting-stands).

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
- [x] Implement [named imports](../spec/modules/imports.md), selecting
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
- [x] Rename `spec/undecided/samples.f.mjs` to `samples.f.js`, the leaf the
      compiler accepts as written, with the three references to its name.
- [x] Convert `zlib/bits`: read `input[first + i]` as `input[Number(first + i)]`
      and rename. `zlib/huffman`, the leaf it exposes, stays refused: the
      table above.
- [x] Convert `js/ast/invocation`: build the rest projections without
      `Array.from`, read the rest index as `Number(length)`, rename.
- [x] Convert `types/stack_walk`: respell its two destructuring assignments
      through a `const` of the pair, and rename.
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
