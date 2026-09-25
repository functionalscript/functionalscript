## Member functions of the built-in types

**Priority:** P2
**Status:** open — `toString` dispatch and `Array`'s `at` are wired; default
function-text semantics remain incomplete, as tracked in the checklist below

### Problem

The compiler admits a method call whose name is a built-in member function,
`[1, 2].at(0)` or `n.toFixed(2)`: the names `allowedCalls` in
[`fjs/js/prototype`](../../fjs/js/prototype/module.f.mjs) lists, one row
each with its reason in [its README](../../fjs/js/prototype/README.md).
The VM answers `toString` and nothing else. A call step —
`PropertyLambda::end_call`, `OptionPropertyLambda::call`, `option_call` and
`end_call` in [`vm/lambda`](../src/vm/lambda/mod.rs) — resolves an own
property or element, then the receiver type's built-in from the table in
`vm/lambda/method.rs`, then throws the `TypeError` for calling `undefined`;
every built-in but `toString` is missing from that table, so `[1, 2].at(0)`
throws where JavaScript answers `1`. A compiled module that calls one is
wrong on this VM until its entry lands, which is the divergence the
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

**One file per built-in**, under the receiver's type — `vm/array/at.rs`,
`vm/string/at.rs`, `vm/number/to_fixed.rs` — each with its tests, the same
layout the per-type `member_access.rs` files have. A name shared by types,
`at`, `concat`, `includes`, `indexOf`, `lastIndexOf`, `slice`, `toString`,
is one entry per type, since the algorithms differ. Callbacks — `map`,
`filter`, `reduce` and the rest — reach the user's function through
`Function::call` with an arguments array of the element, its index and the
array itself.

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

**Function `toString`: required semantic rendering.** The placeholder in
`fn_to_string` (`vm/primitive_coercion.rs`) and the host evaluator's wrapper
text are existing implementation gaps, not accepted successful output.
The former direction to accept that stub until Stage 7 is superseded by the
[default function-text contract](../../spec/todo/serialization.md#function-text-and-serialization)
and the [named/rest rendering requirements](../../spec/todo/3120-parameters.md#default-function-text-render-or-refuse).

Keep enough association with the function's semantic EDAG, and captured
frame where the selected contract needs it, to use the shared default
renderer. Direct `f.toString()`, `Any::to_string` / `String(f)`, array
`join` / `toString` over functions, property-key conversion and admitted
string-method coercions must reach the same operation. Fixing only the
member-dispatch entry leaves the indirect paths wrong. Full EDAG embedding
and hashing may remain Stage 7 work; the association needed for supported
default conversions may not wait for it. Resolve only the rendering choices
needed by each supported case in the serialization TODO; user-defined
overrides are separate from this required default behavior.

Preserve supported function creation, calls, returns, exports and host calls,
including call-only consumers and nested returned functions. Supply and prove
the association/rendering mechanism before replacing a supported callable
path. Do not reject exports to avoid later conversion. Explicit refusal is
only for genuinely unsupported conversion cases at their established boundary,
not a replacement for supported behavior. Neither placeholders nor host
wrapper text satisfy the contract. This documentation correction changes no
runtime behavior; the `Function` checklist remains open until semantic
rendering and its conversion paths are proved, not merely dispatched.

`Number`'s and `BigInt`'s `toString` with a radix is not written yet, and
the entry, `to_string` in `vm/lambda/method.rs`, refuses one: on a number or
a bigint it throws for any radix but an absent one, `undefined` and `10`, so
`(255).toString(16)` fails where JavaScript answers `"ff"`. Reading the radix
as ten, as the entry did before, answered `"255"` — a different successful
value, which the [principles](../../spec/README.md#principles) forbid;
refusing is missing support, which they allow
([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
The plan for the radix itself, the radix task below, is a radix for integers and for bigints,
and a throw for a non-integer with a radix other than ten, which the
specification leaves implementation-approximated, with the corpus pinning
integers and radix ten alone.

**`toString` is mostly written.** `Any::to_string`, the `String(x)`
conversion in `vm/string_coercion.rs`, answers what `x.toString()` answers
for a number, a boolean, a bigint and a string, `[object Object]` for an
object and the comma-joined elements for an array, so the first entries
are a dispatch over bodies that exist. Two gaps it shares with the
conversion path: an own `toString` or `valueOf` on an object is not
called by `ToPrimitive` yet, where JavaScript's `String({ toString: f })`
calls `f` — the same own-property-first lookup as the call step, to wire
once for both — and `Number`'s `toString` takes no radix.

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
- [ ] `toString` applies a radix for `Number` and `BigInt`, with corpus
      cases, lifting the refusal above.
- [ ] Corpus cases for every entry, run on the host engine and as
      generated Rust. Use the adopted EDAG-rendering contract as the oracle
      for default function text; native wrapper text is not that oracle.
- [ ] `ToPrimitive` calls an object's own `toString` and `valueOf`, the
      lookup the call step uses, so `String(o)` and `o.toString()` agree.

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

`String` — the contracts, what is out by design, and the landing order are
[string-member-functions](./string-member-functions.md):

- [ ] `at`
- [ ] `charAt`
- [ ] `charCodeAt`
- [ ] `codePointAt`
- [ ] `concat`
- [ ] `endsWith`
- [ ] `includes`
- [ ] `indexOf`
- [ ] `isWellFormed`
- [ ] `lastIndexOf`
- [ ] `padEnd`
- [ ] `padStart`
- [ ] `repeat`
- [ ] `replace`
- [ ] `replaceAll`
- [ ] `slice`
- [ ] `split`
- [ ] `startsWith`
- [ ] `substring`
- [x] `toString`
- [ ] `toWellFormed`
- [ ] `trim`
- [ ] `trimEnd`
- [ ] `trimStart`

`Number` — [string-member-functions](./string-member-functions.md) too:

- [ ] `toExponential`
- [ ] `toFixed`
- [ ] `toPrecision`
- [x] `toString` — radix ten; the radix argument is the infrastructure
      task above, since the specification leaves other radices
      implementation-approximated for non-integers.

`Boolean`:

- [x] `toString`

`BigInt`:

- [x] `toString` — radix ten; every radix is fully specified and is the
      infrastructure task above.

`Function`:

- [ ] `toString` — dispatch exists, but `fn_to_string` still returns a
      placeholder. Provide semantic EDAG association and the shared default
      renderer; full Stage 7 embedding is not a prerequisite or a waiver.
- [ ] Prove direct and indirect default conversions: `f.toString()`,
      `String(f)`, function elements in arrays (`join` / `toString`), property
      keys and admitted string-method coercions. Include returned/exported
      and nested callables, call-only export consumers, and identity checks.
      A registered method is not enough: test each conversion path against
      the selected EDAG renderer, with no placeholder or wrapper fallback.
      Preserve supported calls/returns/exports; refuse only genuinely
      unsupported conversion cases at their established boundary.

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
