## Define the built-in member functions once, in FunctionalScript

**Priority:** P2
**Status:** wip

### Problem

Every member function the compiler admits — the `allowedCalls` of
[`js/prototype`](../prototype/module.f.js) — is implemented at least twice,
in two languages. The represented interpreter answers it in
[`edag/value/method`](../../edag/value/method/module.f.mjs)'s `stringMethod`
and `numberMethod` and in
[`edag/value/array_method`](../../edag/value/array_method/module.f.mjs), for
the most part by handing the receiver to the host engine; NaNVM answers it
again in Rust, in `nanvm/lib/src/vm/lambda`'s `string.rs`, `number.rs` and
`method.rs`. Three more files exist only to keep the two in agreement: the
admission list itself, the completeness table
[`nanvm/methods`](../../nanvm/methods/module.f.mjs) generates for the VM,
and the parity corpus [`nanvm/member`](../../nanvm/member/module.f.js).
Admitting `toLowerCase` and `toUpperCase`
([#2864](https://github.com/functionalscript/functionalscript/pull/2864))
touched, at `0d25f83a`, seventeen files for two names, and most of that diff
said the same semantics a second and a third time.

The duplication is not only cost. Where the interpreter delegates to the host
engine, its answer is the host's, and a module then means what the engine it
runs on means — the divergence the language refuses everywhere else, and the
reason `toLowerCase` had to pin a Unicode version while `normalize` stays
refused. A third target language would be a third implementation, and the
same three-way split awaits the static functions
([`Number.isInteger`, `Math.*`](../../../doc/CONVERTING.md)) the language
plans to admit, and any operator whose semantics a VM need not own natively.

### Proposal

**One module, in FunctionalScript, is the definition.** A new
`fjs/js/runtime/module.f.js`, beside the admission list, exports `runtime`:
an object keyed by the seven receiver types `nanvm/methods` already names —
`object`, `array`, `string`, `number`, `boolean`, `bigint`, `function` —
each an object keyed by member name, each entry a function of the receiver
and then the arguments as the call passed them, `undefined` past the end:

```js
export const runtime = {
    string: {
        startsWith: (self, search, position) => {
            const s = String(search)
            const start = clamp(position, self.length)
            return self.slice(start, start + s.length) === s
        },
        // ...
    },
    // ...
}
```

A FunctionalScript function reads no `this`, so the receiver is a parameter,
which is the shape NaNVM's `Method<A>` — `fn(Any<A>, Array<A>)` — has
already. The second level is keyed by name rather than closed over so that
the table is data: a generator enumerates it, the completeness test derives
*answered* from its keys, and a reader finds `string.startsWith` where
`fjs/js/prototype`'s README has its row.

**The compiler is the generator.** The module is an authored `.f.js` the
current compiler accepts, so `fjs compile` through the Rust backend
([`edag/rust`](../../edag/rust/module.f.mjs)) is the runtime for Rust, and
another target's backend is the runtime for that target. No generator is
written for this; the module adds `npm start compile` to the checks it calls
for, as every authored `.f.js` does.

**A declared floor of primitives.** A body is written over what the language
has as nodes — the operators, `String` and `Number`, `typeof`, property
access, array literals and spread, calls, `?:`, `throw`, the loop form —
and over a few member functions no body can define in terms of the rest.
Those are the primitives a VM must bind natively, and the module names
them, as an exported list of `[type, name]` pairs with no body: `length`
as a property each value owns, and for strings a code-unit read
(`charCodeAt`) and a substring (`slice`); for arrays an element read by a
runtime number index, which the language has
([spec: property access](../../../spec/README.md#property-access)). An
entry is either a primitive or has a body, never both, and the
completeness test checks that the pairs `allowedCalls` admits are exactly
the primitives plus the bodies plus the pending list, which is what it
checks today with a different partition.

**A VM chooses how to answer a derived function.** The interpreter runs
the body; the AOT Rust output links the compiled runtime; and a VM may keep
or add a native binding of its own where it measures the gain — NaNVM's
current Rust implementations become exactly that, optimizations, each one
free to go when the compiled body is fast enough. Either way the corpus in
`nanvm/member` checks the native answer against the body, as it checks it
against the host today, and the body is the reference. That fixes two
things the spec currently lists as implementation-defined: an inconsistent
`toSorted` comparator gets the one order the runtime's sort gives, on every
executor, and the interpreter no longer answers with the host's Unicode
tables.

**The interpreter runs the runtime as EDAG.** The interpreter's values are
represented — `['[]', items]`, `['undefined']` — so it cannot call the
module's host functions on them. The runtime is compiled to EDAG once, as a
generated `gen.*` module `npm run gen` writes and CI checks for staleness,
and `edag/value/method` calls the entry for a pair through `call` as it
calls any function value, with the primitives the one table it keeps by
hand. The interpreter thereby stays independent of the compiler at run
time, and the floor is explicit rather than discovered when the
interpreter first meets a call inside the runtime.

**The cost is accepted.** An interpreted `indexOf` is a loop where the
host's was native. DESIGN prefers simplicity, the VM keeps its option to
bind natively, and the measurement that would change the trade is one the
corpus can take.

**What waits on the next step.** Some bodies need a primitive the member
functions do not give: a string from a code unit (`String.fromCharCode`)
for `toLowerCase`, `toUpperCase` and `toWellFormed`, whose casing table
would then be a `gen.*` module from the Unicode data files, pinning the
version in this repository rather than in rustc's standard library; a
bigint from a number (`BigInt`) for `toFixed`, `toPrecision`,
`toExponential` and a nondecimal `toString` radix, which are exact decimal
expansions of a double. These stay native, listed as pending-derived, until
the static-function table lands. That table is the second step of this
design — the same split, keyed by global and name — and operators whose
semantics the floor can carry, `**` the example, the third; each gets its
own `todo/` when its turn comes, and neither is designed here.

### Tasks

- [ ] File this proposal.
- [ ] `fjs/js/runtime/module.f.js` with `primitives` and the first derived
      batch: the string searches and comparisons (`startsWith`, `endsWith`,
      `includes`, `indexOf`, `lastIndexOf`), `at`, `charAt`, `codePointAt`,
      `substring`, `padStart`, `padEnd`, `repeat`, `concat`, `trim`,
      `trimStart`, `trimEnd`, `split`, `replace`, `replaceAll`,
      `isWellFormed`; `proof.f.mjs` at full coverage; `npm start compile`
      accepts it. One pull request per few functions, as
      [SESSION.md](../../../doc/SESSION.md) asks.
- [ ] The array batch: every admitted `array` name, `toString` as `join`.
- [ ] `nanvm/methods` reads `primitives` and `runtime` and generates the
      native/runtime/pending partition; `gen.methods.rs` and the test
      beside `method` in `nanvm/lib/src/vm/lambda/method.rs` follow.
- [ ] `edag/value/method` answers derived names from the generated EDAG and
      stops calling the host engine for them; `edag/value/array_method`
      likewise.
- [ ] The Rust backend's output links the compiled runtime; the corpus
      runs it; decide per function, with a measurement, whether the
      hand-written Rust stays.
- [ ] Decide whether `allowedCalls` is derived from the runtime's keys, so
      `js/prototype` keeps only `prohibitedCalls` and the reasons.
- [ ] File the static-function table and the operator step as their own
      `todo/`s when the first batch has landed.

### Related

- [`js/prototype`](../prototype/module.f.js) — the admission list; its
  README holds the reason for each name.
- [`nanvm/lib/todo/member-functions.md`](../../../nanvm/lib/todo/member-functions.md)
  — the native completeness table this design re-partitions.
- [`nanvm/methods`](../../nanvm/methods/module.f.mjs) and
  [`nanvm/member`](../../nanvm/member/module.f.js) — the generator and the
  parity corpus.
- [`compiler/todo/interpret-edag.md`](../../compiler/todo/interpret-edag.md)
  — native self-hosting compiles the interpreter and its dependency closure
  to Rust; the runtime is part of that closure.
- [`nanvm/lib/todo/callable-function-objects.md`](../../../nanvm/lib/todo/callable-function-objects.md)
  — the `static function` tag a VM binding static functions needs.
- [spec: built-in member functions](../../../spec/README.md#built-in-member-functions)
  — the admitted set and the native-execution limits this design narrows.
- [#2864](https://github.com/functionalscript/functionalscript/pull/2864)
  — the measurement.
