## Define the built-in member functions once, in FunctionalScript

**Priority:** P2
**Status:** wip — the design is approved by `sergey-shandar` on
[#2869](https://github.com/functionalscript/functionalscript/pull/2869#issuecomment-6141562332)

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

**One module, in FunctionalScript, is the definition — of each body and
of which functions each type has.** A new `fjs/js/runtime/module.f.js`,
beside the admission list, exports `runtime`: an object keyed by the seven
receiver types `nanvm/methods` already names — `object`, `array`, `string`,
`number`, `boolean`, `bigint`, `function` — each an object keyed by member
name, each entry a function of the receiver and then the arguments as the
call passed them, `undefined` past the end:

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
the table is data: a VM enumerates it, and a reader finds `string.startsWith`
where `fjs/js/prototype`'s README has its row.

**The keys are the admitted set.** A type has exactly the member functions
its object holds — every one of them, whether the entry is a body or the
marker below — and `allowedCalls` is derived from the union of the keys,
no longer a hand-written list: `js/prototype` keeps the prototype name
lists and `prohibitedCalls`, which exist for the parser alone — the
receiver's type is unknown at compile time, so the parser admits a call by
name and refuses a prohibited one with the error that names the reason. A
VM never sees a prohibited name, since no EDAG carries one; whether the
EDAG reader checks it as well is its own choice, and a native VM does not
care. The completeness table `nanvm/methods` generates and its four rows
(`gen.methods.rs`) exist to keep two hand-written lists in agreement, and
retire: with one list there is nothing to compare.

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
Those are the primitives a VM must bind natively, and the module keys
them in the same object, with the string `'native'` where a body would
be, so that an admitted name is a key whichever kind it is:

```js
export const runtime = {
    string: {
        charCodeAt: 'native',
        slice: 'native',
        startsWith: (self, search, position) => { /* ... */ },
        // ...
    },
    // ...
}
```

`length` stays a property each value owns and is on no list; the string
primitives are a code-unit read (`charCodeAt`) and a substring (`slice`),
and for arrays an element read by a runtime number index, which the
language has
([spec: property access](../../../spec/README.md#property-access)). A
name with no body yet — the ones waiting on a static function, below —
carries the same marker, since a VM has the same duty towards both: bind
it natively. Which of the two a marker is, and why, is a comment beside
it. An entry is a body or the marker, never both, and the one check left
is that a VM binds every marked name, a test over the short list alone.

**A VM binds the object dynamically.** It reads the compiled runtime's
keys and installs each function value as the fallback member function of
its type: a call step resolves an own property, then the type's native
binding, then the runtime's body, then throws the `TypeError` for calling
`undefined`, as it does today with a hand-written table in the third
place. The tables in `nanvm/lib/src/vm/lambda`'s `method.rs`, `string.rs`
and `number.rs` shrink to the marked names; the interpreter runs the body,
the AOT Rust output links the compiled runtime, and a VM may still bind a
native implementation of a name that has a body where it measures the gain
— NaNVM's current Rust implementations become exactly that, optimizations,
each one free to go when the compiled body is fast enough. Either way the
corpus in
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
expansions of a double. These stay keyed with the `'native'` marker, so
they remain admitted throughout, until the static-function table lands.
That table is the second step of this
design — the same split, keyed by global and name — and operators whose
semantics the floor can carry, `**` the example, the third; each gets its
own `todo/` when its turn comes, and neither is designed here.

### Tasks

- [ ] File this proposal.
- [ ] `fjs/js/runtime/module.f.js` with every admitted name keyed — the
      marked ones first, so the derived list `allowedCalls` never loses a
      name — and the first derived batch: the string searches and
      comparisons (`startsWith`, `endsWith`,
      `includes`, `indexOf`, `lastIndexOf`), `at`, `charAt`, `codePointAt`,
      `substring`, `padStart`, `padEnd`, `repeat`, `concat`, `trim`,
      `trimStart`, `trimEnd`, `split`, `replace`, `replaceAll`,
      `isWellFormed`; `proof.f.mjs` at full coverage; `npm start compile`
      accepts it. One pull request per few functions, as
      [SESSION.md](../../../doc/SESSION.md) asks.
- [ ] The array batch: every admitted `array` name, `toString` as `join`.
- [ ] `allowedCalls` is derived from the runtime's keys; `js/prototype`
      keeps the prototype lists and `prohibitedCalls` for the parser.
      `nanvm/methods`, `gen.methods.rs` and the four-row test beside
      `method` in `nanvm/lib/src/vm/lambda/method.rs` retire, replaced by
      the one test that every marked name is bound.
- [ ] `edag/value/method` answers derived names from the generated EDAG and
      stops calling the host engine for them; `edag/value/array_method`
      likewise.
- [ ] NaNVM binds the compiled runtime's keys as each type's fallback
      member functions; its hand tables shrink to the marked names; the
      corpus runs the bound runtime; decide per function, with a
      measurement, whether a native implementation stays.
- [ ] File the static-function table and the operator step as their own
      `todo/`s when the first batch has landed.

### Related

- [`js/prototype`](../prototype/module.f.js) — the admission list; its
  README holds the reason for each name.
- [`nanvm/lib/todo/member-functions.md`](../../../nanvm/lib/todo/member-functions.md)
  — the native completeness table this design retires.
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
