## Member functions of the built-in types

**Priority:** P2
**Status:** open — `toString` is answered on every type, as a dispatch to
`Any::to_string`; the rest is unchecked

### Problem

The compiler admits a method call whose name is a built-in member function,
`[1, 2].at(0)` or `n.toFixed(2)`: the names `allowedCalls` in
[`fjs/js/prototype`](../../fjs/js/prototype/module.f.mjs) lists, one row
each with its reason in [its README](../../fjs/js/prototype/README.md).
The VM does not answer any of them. A call step — `PropertyLambda::end_call`,
`OptionPropertyLambda::call`, `option_call` and `end_call` in
[`vm/lambda`](../src/vm/lambda/mod.rs) — reads the property and calls the
value, so on a built-in name the read answers `undefined` and the call
throws the `TypeError` for calling it, where JavaScript answers `1`. A
compiled module that calls one is wrong on this VM until this lands, which
is the divergence the two-list design exists to prevent: the compiler's
list is the set of names the VM must answer.

### Proposal

**The algorithm of a call step**, after the guard and the arguments — a
nullish receiver throws first, and a guarded step skips a nullish receiver
with its arguments untouched ([`vm/lambda`](../src/vm/lambda/mod.rs)):

1. **An object**: an own property of the name, `Object::member_access`. A
   function is called with the arguments; any other value is the
   `TypeError` for calling a non-function. An own property shadows the
   built-in, as in JavaScript, so `{ toString: f }.toString()` calls `f`.
2. **An array**: an element at a canonical index key,
   `Array::member_access`, called or thrown the same way — `[f][0](1)` is a
   legal program that calls `f`. A prototype name is never an index and an
   index never a prototype name, so the two lookups never compete.
3. **Every type**: the type's built-in of that name, the specification's
   algorithm over the receiver and the arguments. A string's index owns a
   character and a function owns `length`, neither callable, and the
   primitives own nothing, so no other type needs the own-property step:
   the built-in table and then the `TypeError` give what JavaScript gives.
4. Otherwise the `TypeError` for calling `undefined`, as JavaScript throws
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
reaches `nanvm-lib/tests/test/generated.rs` through `npm run gen`. Until
that test passes, this file is the checklist, and a pair is checked here
in the pull request that lands it. Each entry's behavior is pinned against
the JavaScript oracle as the operators are: the shared corpus drives both
the amnesia evaluator on the host engine and the generated Rust tests.

**Function `toString`** is on the list and is a stub until a function
carries its EDAG (`callable-function-objects.md`, Stage 7): it answers the
placeholder `fn_to_string` in `vm/primitive_coercion.rs` already answers,
since the compiler has transformed the source text the real one would
answer. The same stub reaches every method that converts a function to a
string on the way — an array's `join` or `toString` over an element that
is a function, a string method whose argument is one — and the host
evaluator in `fjs/edag/operations` has the same gap with a different
placeholder, the text of the closure it wraps a function in. One task,
Stage 7, closes all of it. A stub with its TODO is the accepted shape here;
the design principle against a plausible wrong value binds the MVP
surface. `Number`'s `toString` with a radix is the other stub: a
non-integer with a radix other than ten is implementation-approximated by
the specification, so this VM's entry throws for that shape rather than
approximate, and the corpus pins integers and radix ten alone.

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
      uses the lookup — `Member` in `vm/lambda/member.rs`.
- [ ] The dispatch table per type — `method` in `vm/lambda/method.rs`
      holds the first entry and matches on the key alone, since every type
      has `toString` — and the generated completeness test over
      `allowedCalls`.
- [ ] `toString` reads its arguments: a radix for `Number` and `BigInt`.
      Today the arguments are not read, so `(255).toString(16)` answers
      `"255"` — a stub with this as its TODO.
- [ ] Corpus cases for every entry, run on the host engine and as
      generated Rust.
- [ ] `ToPrimitive` calls an object's own `toString` and `valueOf`, the
      lookup the call step uses, so `String(o)` and `o.toString()` agree.

`Object`:

- [x] `toString`

`Array`:

- [ ] `at`
- [ ] `concat`
- [ ] `every`
- [ ] `filter`
- [ ] `find`
- [ ] `findIndex`
- [ ] `findLast`
- [ ] `findLastIndex`
- [ ] `flat`
- [ ] `flatMap`
- [ ] `includes`
- [ ] `indexOf`
- [ ] `join`
- [ ] `lastIndexOf`
- [ ] `map`
- [ ] `reduce`
- [ ] `reduceRight`
- [ ] `slice`
- [ ] `some`
- [ ] `toReversed`
- [ ] `toSorted`
- [ ] `toSpliced`
- [x] `toString`
- [ ] `with`

`String`:

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

`Number`:

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

- [x] `toString` — a stub answering `fn_to_string`'s placeholder until a
      function carries its EDAG.

### Related

- [`fjs/js/prototype/README.md`](../../fjs/js/prototype/README.md) — the
  table: both lists, one row per name with its reason.
- [`fjs/edag/README.md`](../../fjs/edag/README.md), Chains — the two bits
  and the four steps the lambda types transcribe; the printer's
  per-position laziness is in
  [`fjs/edag/rust/module.f.mjs`](../../fjs/edag/rust/module.f.mjs).
- [`callable-function-objects.md`](./callable-function-objects.md) — Stage
  4, the method call, which this file completes.
- [`vm/lambda/mod.rs`](../src/vm/lambda/mod.rs) — the exits that change,
  and the `Region` state that grows a key.
