## Member functions of the built-in types

**Priority:** P2
**Status:** open — every call [`fjs/js/prototype`](../../fjs/js/prototype/module.f.js)
allows is answered (`vm/lambda/gen.methods.rs` has no pending pair); the
corpus cases for each entry and the property-key conversion of a function
remain, as the two unchecked boxes below

### Problem

The compiler admits a method call whose name is a built-in member function,
`[1, 2].at(0)` or `n.toFixed(2)`: the names `allowedCalls` in
[`fjs/js/prototype`](../../fjs/js/prototype/module.f.js) lists, one row
each with its reason in [its README](../../fjs/js/prototype/README.md).
When this was filed the VM answered `toString` and nothing else. A call step —
`PropertyLambda::end_call`, `OptionPropertyLambda::call`, `option_call` and
`end_call` in [`vm/lambda`](../src/vm/lambda/mod.rs) — resolves an own
property or element, then the receiver type's built-in from the table in
`vm/lambda/method.rs`, then throws the `TypeError` for calling `undefined`;
every built-in but `toString` was missing from that table, so `[1, 2].at(0)`
threw where JavaScript answers `1`. A compiled module that called one was
wrong on this VM until its entry landed, which is the divergence the
two-list design exists to prevent: the compiler's list is the set of names
the VM must answer.

### Proposal

**The algorithm of a call step**, after the guard and the arguments — a
nullish receiver throws first, and a guarded step skips a nullish receiver
with its arguments untouched ([`vm/lambda`](../src/vm/lambda/mod.rs)):

1. **The own property**, the same dispatch the read makes: an object's
   property, an array's element, a string's character, a function's
   `length`. A function is called with the arguments; any other value is
   the `TypeError` for calling a non-function, never passed over for a
   built-in. An own property shadows the built-in, as in JavaScript, so
   `{ toString: f }.toString()` calls `f`, `[f][0](1)` calls the element,
   and `"a"[0]()` throws. A prototype name is never an index and an index
   never a prototype name, so the two lookups never compete. The guard of
   `?.()` asks this same lookup, so `"a"[0]?.()` throws rather than skips,
   the character being no more nullish than `f.length` is.
2. **The built-in**: the receiver type's built-in of that name, the
   specification's algorithm over the receiver and the arguments.
3. Otherwise the `TypeError` for calling `undefined`, as JavaScript throws
   on a type without the method.

The lookup may follow the arguments because nothing here mutates, so its
answer cannot change in between.

**Where it lives.** The live state of `PropertyLambda` and
`OptionPropertyLambda` becomes the receiver and the key rather than the
read's value; `end` performs the read, and the call exits run the steps
above. `option_call`'s guard uses the same lookup, so `({})?.toString?.()`
calls rather than skips. `Function::call` and `IFunction::call` are
unchanged: no user function reads `this`, and the receiver is consumed by
the built-in and never handed on. The printer and the generated code are
unchanged — `Any::dot(a, key).end_call(args)` is already the spelling.

**One file per built-in, or per family sharing one algorithm**, under the
receiver's type — `vm/array/at.rs`, `vm/array/reduce.rs` for `reduce` and
`reduceRight`, `vm/string/reads.rs` for the six code-unit reads — each with
its tests, the same layout the per-type `member_access.rs` files have. A
name shared by types, `at`, `concat`, `includes`, `indexOf`, `lastIndexOf`,
`slice`, `toString`, is one entry per type, since the algorithms differ.
Callbacks — `map`, `filter`, `reduce` and the rest — reach the user's
function through `Function::call` with an arguments array of the element,
its index and the array itself.

**Completeness is tested, not promised.** The compiler's list and the VM's
tables must agree, or a name compiles and throws. One test walks
`allowedCalls` against the per-type prototype lists and asserts every
type-and-name pair has an entry — the lists live in FunctionalScript, so
the pairs reach Rust as a generated table, the way the operator corpus
reaches `nanvm-lib/tests/test/gen.corpus/` through `npm run gen`. Until
that test passes, this file is the checklist, and a pair is checked here
in the pull request that lands it. Each entry's behavior is pinned against
the JavaScript oracle as the operators are: the shared corpus drives both
the amnesia evaluator on the host engine and the generated Rust tests.
Default function text is the explicit exception: its oracle is the adopted
EDAG-rendering contract, not authored JavaScript or factory-wrapper source.

**Function `toString`: semantic rendering.** A compiled function carries
its text, the FunctionalScript writer's rendering of its EDAG
(`tryFunctionText` in `fjs/compiler/serializer`), handed to
`IStaticFunction::static_function` by the Rust printer; `ToPrimitive` of a
function answers it, so `f.toString()`, `String(f)`, `+`, an array joined
and a string method's argument all reach the one text. A function without
text — a host or hand-written one — is refused (`FUNCTION_TEXT`), never
answered with a placeholder. What remains is the property key, which no
module can compute but through the
[`entry`](../../spec/README.md#reading-an-entry-at-run-time) helper, whose
key conversion reaches a function's text. And the host evaluator's own rendering, which the
corpus's `host` marker skips until it has one.

`Number`'s and `BigInt`'s `toString` take a radix, `2` to `36`: an integer
and every bigint convert exactly, and a fraction with a radix other than ten
is refused, since ECMAScript leaves its digits to the engine
([`vm/string/README.md`](../src/vm/string/README.md)).

**`toString` is mostly written.** `Any::to_string`, the `String(x)`
conversion in `vm/string_coercion.rs`, answers what `x.toString()` answers
for a number, a boolean, a bigint and a string, `[object Object]` for an
object and the comma-joined elements for an array, so the first entries
are a dispatch over bodies that exist. `ToPrimitive` calls an object's
own `toString` or `valueOf`, the same own-property-first lookup as the call
step, so `String(o)` and `o.toString()` agree
([`to-primitive.md`](./to-primitive.md)).

### Tasks

Infrastructure:

- [x] `vm/lambda`: the live state holds the receiver and the key; `end`
      reads; the call exits run the algorithm above; `option_call`'s guard
      uses the lookup — `Member` in `vm/lambda/member.rs`, whose `own` is
      one dispatch for the read, the callee and the guard.
- [x] The dispatch table per type — `method` in `vm/lambda/method.rs`
      answers `toString` on the key alone, since every type has it, and
      every other name from the receiver type's own table, `array` the
      first.
- [x] The generated completeness test over `allowedCalls` —
      `completeness` in `vm/lambda/method.rs`, over the table
      `fjs/nanvm/methods` prints as `vm/lambda/gen.methods.rs`, with the
      unanswered pairs listed there as `pending`.
- [x] `toString` on a `Number` or a `BigInt` throws for any radix argument
      but `undefined` and `10`, pinned by `to_string_radix` in
      `vm/lambda/method.rs`, so no module gets `"255"` for
      `(255).toString(16)` while the radix is written.
- [x] `toString` applies a radix for `Number` and `BigInt`, with corpus
      cases, lifting the refusal above.
- [ ] Corpus cases for every entry, run on the host engine and as
      generated Rust. Use the adopted EDAG-rendering contract as the oracle
      for default function text; native wrapper text is not that oracle.
- [x] `ToPrimitive` calls an object's own `toString` and `valueOf`, the
      lookup the call step uses, so `String(o)` and `o.toString()` agree:
      [`to-primitive.md`](./to-primitive.md).

`Object`:

- [x] `toString`

`Array` — complete; what is out by design, and the arguments whose
presence decides an answer, are
[`vm/array/README.md`](../src/vm/array/README.md):

- [x] `at` — `vm/array/at.rs`; the index is `Number::to_integer_or_infinity`,
      `ToIntegerOrInfinity` of the argument converted by `ToNumber`.
- [x] `concat` — `vm/array/concat.rs`
- [x] `every` — `vm/array/every.rs`
- [x] `filter` — `vm/array/filter.rs`
- [x] `find` — `vm/array/find.rs`
- [x] `findIndex` — `vm/array/find_index.rs`
- [x] `findLast` — `vm/array/find.rs`
- [x] `findLastIndex` — `vm/array/find_last_index.rs`
- [x] `flat` — `vm/array/flat.rs`
- [x] `flatMap` — `vm/array/flat.rs`
- [x] `includes` — `vm/array/includes.rs`
- [x] `indexOf` — `vm/array/index_of.rs`
- [x] `join` — `vm/array/join.rs`
- [x] `lastIndexOf` — `vm/array/last_index_of.rs`
- [x] `map` — `vm/array/map.rs`
- [x] `reduce` — `vm/array/reduce.rs`
- [x] `reduceRight` — `vm/array/reduce.rs`
- [x] `slice` — `vm/array/slice.rs`
- [x] `some` — `vm/array/some.rs`
- [x] `toReversed` — `vm/array/to_reversed.rs`
- [x] `toSorted` — `vm/array/to_sorted.rs`
- [x] `toSpliced` — `vm/array/to_spliced.rs`
- [x] `toString`
- [x] `with` — `vm/array/with.rs`

`String` — complete; what is out by design, and when an argument is read,
are [`vm/string/README.md`](../src/vm/string/README.md):

- [x] `at` — `vm/string/reads.rs`
- [x] `charAt` — `vm/string/reads.rs`
- [x] `charCodeAt` — `vm/string/reads.rs`
- [x] `codePointAt` — `vm/string/reads.rs`
- [x] `concat` — `vm/string/building.rs`
- [x] `endsWith` — `vm/string/search.rs`
- [x] `includes` — `vm/string/search.rs`
- [x] `indexOf` — `vm/string/search.rs`
- [x] `isWellFormed` — `vm/string/reads.rs`
- [x] `lastIndexOf` — `vm/string/search.rs`
- [x] `padEnd` — `vm/string/building.rs`
- [x] `padStart` — `vm/string/building.rs`
- [x] `repeat` — `vm/string/building.rs`
- [x] `replace` — `vm/string/patterns.rs`
- [x] `replaceAll` — `vm/string/patterns.rs`
- [x] `slice` — `vm/string/building.rs`
- [x] `split` — `vm/string/patterns.rs`
- [x] `startsWith` — `vm/string/search.rs`
- [x] `substring` — `vm/string/building.rs`
- [x] `toString`
- [x] `toWellFormed` — `vm/string/reads.rs`
- [x] `trim` — `vm/string/building.rs`
- [x] `trimEnd` — `vm/string/building.rs`
- [x] `trimStart` — `vm/string/building.rs`

`Number` — complete, [`vm/string/README.md`](../src/vm/string/README.md) too:

- [x] `toExponential` — `vm/number/format.rs`
- [x] `toFixed` — `vm/number/format.rs`
- [x] `toPrecision` — `vm/number/format.rs`
- [x] `toString` — every radix for an integer; a fraction only in radix
      ten, since ECMAScript leaves its other radices to the engine.

`Boolean`:

- [x] `toString`

`BigInt`:

- [x] `toString` — every radix, `vm/bigint/radix.rs`.

`Function`:

- [x] `toString` — the function's text, the writer's rendering of its
      EDAG (`nanvm-lib/todo/to-primitive.md`, Stage 3).
- [ ] Prove direct and indirect default conversions. Done: `f.toString()`,
      `String(f)`, `+`, function elements in arrays (`join` / `toString`),
      a string method's argument, returned, exported and nested functions,
      and identity, which the text leaves unchanged (the corpus's `host` and
      `===` cases and `nanvm-harness/fixtures/function-text.mjs`). A
      call-only export consumer is the harness's `Action::Call`. Left:
      property keys.

### Related

- [Default function text](../../spec/todo/serialization.md#function-text-and-serialization)
  — adopted rendering contract and the remaining rendering choices.
- [Named/rest rendering requirements](../../spec/todo/3120-parameters.md#default-function-text-render-or-refuse)
  — shared rendering without regressing supported calls, returns or exports.
- [Native function-text review](https://github.com/functionalscript/functionalscript/pull/2220#discussion_r4096310135)
  — remove the obsolete Stage 7 placeholder exception and completion claim.
- [`vm/array/README.md`](../src/vm/array/README.md) — the `Array`
  built-ins: what is out by design, and why.
- [`fjs/js/prototype/README.md`](../../fjs/js/prototype/README.md) — the
  table: both lists, one row per name with its reason.
- [`fjs/edag/README.md`](../../fjs/edag/README.md), Chains — the two bits
  and the four steps the lambda types transcribe; the printer's
  per-position laziness is in
  [`fjs/edag/rust/module.f.mjs`](../../fjs/edag/rust/module.f.mjs).
- [`callable-function-objects.md`](./callable-function-objects.md) — Stage
  4, the method call: the mechanism a built-in here is reached through,
  landed. Which built-ins it reaches is this file's own checklist, not
  that stage's.
- [`vm/lambda/mod.rs`](../src/vm/lambda/mod.rs) — the exits that change,
  and the `Region` state that grows a key.
