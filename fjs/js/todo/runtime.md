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

**One module, in FunctionalScript, is the definition.** A new
`fjs/js/runtime/module.f.js`, beside the admission list, exports `runtime`:
an object keyed by receiver type, the names `nanvm/methods` already uses —
`object`, `array`, `string`, `number`, `boolean`, `bigint`, `function` —
each an object keyed by member name, each entry a body: a function of the
receiver and then the arguments as the call passed them, `undefined` past
the end:

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
the first, which is where NaNVM's `Method<A>` — `fn(Any<A>, Array<A>)` —
takes it too. The rest differ: a native method takes the call's arguments
as one array, a body takes them positionally, as a function in the
language must. So a VM does not treat a body as a `Method<A>`; it calls
the body as it calls any function value, with `[receiver, ...args]`, the
receiver prepended to the arguments the call spread, which `Member::call`
in `vm/lambda/member.rs` does. That call keeps the arguments' count, so a
body whose algorithm tells an omitted argument from an explicit
`undefined` — `lastIndexOf`'s position, `reduce`'s initial value,
`toSpliced`'s count — takes a rest parameter, `(self, ...args)`, and reads
`args.length`, as the native adapter reads its array's, and so does a
variadic body — `concat`'s items, `push`-like shapes the language may yet
admit — since a function in the language has no `arguments` and a named
parameter list drops what it does not name; a body that is neither names
its parameters, and reads `undefined` past the
end. The second level is keyed by name rather
than closed over so that the table is data: a VM enumerates it, and a
reader finds `string.startsWith` where `fjs/js/prototype`'s README has its
row.

**Bodies only; the admitted set stays where it is.** The table holds a
name once its body is written and nothing before: a name without a body is
absent, and each VM answers it from its own native table as it does today.
Which names a module may call stays `js/prototype`'s — the prototype name
lists and `prohibitedCalls` for the parser, `allowedCalls` for every
executor — and the runtime's `types.ts` pins, at the type level, that
every key is an allowed name on its type's prototype, so a body for a name
the language does not admit, or on the wrong type, fails `tsc`. The keys
are not the admitted set, and need not be: nothing in a `.f.js`
enumerates an object's keys, so a list could not be derived from them, and
a table that keyed every admitted name with a marker in place of a body
would only duplicate the list the parser already has. A VM never sees a
prohibited name, because two boundaries refuse it before any VM runs: the
parser, for source, and for EDAG supplied as data, which no parser made,
the admission `validate`
[`compiler/todo/interpret-edag.md`](../../compiler/todo/interpret-edag.md)
requires to reject a key on either list — a check that stays mandatory
there, since it is the one place such a key could enter. Behind those two
a native VM does not care. The completeness table `nanvm/methods`
generates and its four rows (`gen.methods.rs`) stay, and count a body as
an answer: every admitted pair is answered natively or by a body, and no
prohibited or absent pair is answered at all. The four rows probe
prototype names, so a native entry under a name that is none — a typo,
`charAtt` on an array, which the parser admits as an own-property call
and the native table would then answer ahead of the `TypeError` — escapes
them; the native tables are Rust arrays, enumerable, and the same test
walks each one and asserts every binding is an answered pair of its type,
which is the reverse direction, over every actual binding.

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
Those are the primitives a VM must bind natively, and the runtime's
README names them: `length` stays a property each value owns and is on no
list; the string primitives are a code-unit read (`charCodeAt`) and a
substring (`slice`), and for arrays an element read by a runtime number
index, which the language has
([spec: property access](../../../spec/README.md#property-access)). A
name with no body yet — the ones waiting on a static function, below — is
absent from the table for the same reason a primitive is, and a VM has the
same duty towards both: bind it natively. The README says which is which,
and why.

**A VM binds the object dynamically.** It reads the compiled runtime's
keys and installs each function value as the fallback member function of
its type: a call step resolves an own property, then the type's native
binding, then the runtime's body, then throws the `TypeError` for calling
`undefined`, as it does today with a hand-written table in the third
place. The guard of an optional call, `a.map?.(f)`, asks the same lookup,
native or runtime, so a name whose native entry has gone to a body is
still called, not skipped, and a name neither binds skips with its
arguments unevaluated — the represented executors' `hasMethod` and
NaNVM's `Member::is_nullish` in #2880 both do. The tables in
`nanvm/lib/src/vm/lambda`'s `method.rs`, `string.rs` and `number.rs` are
the one place a native binding lives, and hold two kinds of name: the
names without a body, which they must, and the names a measurement keeps
native, which they may — a native entry for a name that has a body is an
optimization, and it stays in the same table, ahead of the body, for as
long as the measurement says so and leaves when the compiled body is fast
enough. NaNVM's current Rust implementations become exactly that. There
is no second table: the interpreter runs the body, the AOT Rust output
links the compiled runtime, and the corpus in `nanvm/member` has one
oracle per kind of name. A name with a body is checked against the body,
whether the VM answers it natively or not, and the body is the reference;
a name without one — a primitive, or a name waiting on the static-function
step — is checked against the host engine, as every name is today, until
its body lands and the oracle changes with it. That fixes two
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

**Compiling needs no runtime; running does.** The shape is a bootstrap,
and two invariants keep it from being a cycle. First, the compiler never
needs a runtime to *compile*: parsing and lowering run no body, so the
host engine runs the compiler as JavaScript with its own built-ins
answering the compiler's `.map` and `.slice`, and `npm run gen` can delete
every generated file and still write the runtime's EDAG and Rust from
source. A runtime is needed only to *run*: an executor evaluating a module
whose initialization calls a body's name, or the compiler itself once it
is compiled and run on a VM, where the runtime the previous compiler
wrote is the fixed point, as a Rust `core` is for `rustc`. Second, no
initializer in the runtime module's closure — the module and every module
it imports, transitively — calls a member function, so the runtime can
always be interpreted from nothing. The invariant is over the closure
because the compiler runs every imported module's initializer before the
importer's, and a helper the runtime shares with the rest of `fjs/` must
hold it too or be inlined; it is checked mechanically rather than by
reading, since the transpiler's `runtimeAt` interprets the module with no
runtime, and a member call in any initializer of the closure fails that
load. An optimizing pass that evaluated at
compile time would be the one place the compiler runs bodies; it takes
the runtime as an input as the executors do, folds only what the
interpreter answers natively when given none, and so the runtime is
always compiled with no runtime, whatever the pass does elsewhere.

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
expansions of a double. These stay native, and admitted, until the
static-function table lands. That table is the second step of this
design — the same split, keyed by global and name — and operators whose
semantics the floor can carry, `**` the example, the third; each gets its
own `todo/` when its turn comes, and neither is designed here.

### Tasks

- [ ] File this proposal.
- [ ] `fjs/js/runtime/module.f.js` with the first batch of bodies: the
      string searches and comparisons (`startsWith`, `endsWith`,
      `includes`, `indexOf`, `lastIndexOf`), `at`, `charAt`, `codePointAt`,
      `substring`, `padStart`, `padEnd`, `repeat`, `concat`, `trim`,
      `trimStart`, `trimEnd`, `split`, `replace`, `replaceAll`,
      `isWellFormed`; `proof.f.mjs` at full coverage; `npm start compile`
      accepts it. One pull request per few functions, as
      [SESSION.md](../../../doc/SESSION.md) asks.
- [ ] The array batch: every admitted `array` name, `toString` as `join`.
- [ ] `edag/value/method` answers derived names from the generated EDAG and
      stops calling the host engine for them; `edag/value/array_method`
      likewise.
- [ ] NaNVM binds the compiled runtime's keys as each type's fallback
      member functions; the corpus runs the bound runtime; a name whose
      body lands leaves the hand tables unless a measurement keeps it,
      in the same table, as an optimization.
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
