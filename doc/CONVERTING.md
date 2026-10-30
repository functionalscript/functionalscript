# Converting JavaScript to FunctionalScript

How to take a module written in JavaScript — an authored `.f.mjs`, or any
`.mjs` whose logic belongs in the language — and bring it to what the compiler
accepts, so it can be renamed `.f.js`
([`fjs/compiler/README.md`](../fjs/compiler/README.md#stage-2-mark-compiler-compatible-functionalscript)).
The [specification](../spec/README.md) says what the compiler accepts; this
document says what to write instead of what it refuses, one rule per
construct. Each rule is a rewrite the specification already admits, with the
section that admits it, so a conversion changes the spelling and not the
meaning.

Three things hold for every rule:

- **A required function is imported, never copied.** Where a rewrite needs a
  function — `entry` and `min` below, and the helpers later rules
  name — the repository implements it once, in FunctionalScript, and a
  converted module imports it from that module. The specification may spell
  the function out so the compiler can recognize it wherever it is written;
  that is the compiler's contract, not an invitation to paste it. A copy is
  a second implementation that will drift
  ([AGENTS.md §1](../AGENTS.md#1-workflow)).

  This is the strategy for a built-in the language lacks: implement what
  can be implemented as an ordinary FunctionalScript function first, in an
  authored `.f.js`, and let the language take it in later, as syntax sugar
  the compiler recognizes, once its use is understood. Until then the
  function is what it spells, a function like any other the compiler
  compiles, and the EDAG and the VM may have no node for it; a module that
  imports it depends on nothing but the module. A helper that stood in for
  a JavaScript built-in moves into the runtime once the language admits
  that built-in, its body a VM's and no module's, and modules call the
  built-in: `Object.is`'s and the `Number` predicates' did (rules 2–4 and
  6). A helper the compiler recognizes by its shape, as `entry`, stays the
  module it is.
- **The value is preserved.** FunctionalScript is a subset of JavaScript, and
  a converted module is still JavaScript: it must compute what it computed
  before, in both languages. A rewrite that changes a result is a change to
  the module, reviewed as one, never part of a conversion. That includes
  which of two failures a JavaScript engine reports first: a conversion
  keeps every call that may fail in its place in the order ([rule 10](#10-a-call-made-for-its-failure)).
  A refactoring may reorder them, since the
  [failure contract](../spec/principles/README.md#failure-is-one-outcome)
  admits any order, but as a change of its own, never inside a conversion.
- **The compiler is the check.** `fjs compile <input> <output>.f.js` compiles
  one module and stops at its first refusal, with a `line:column`; rename
  only once it accepts the whole module, and `fjs compile` with no arguments
  (`npm start compile`) then holds every authored `.f.js` to the compiler of
  its revision. A rename also renames every runtime import, type reference
  and proof import of the module; the proof stays `proof.f.mjs`
  ([`fjs/AGENTS.md`](../fjs/AGENTS.md#12-proof-coverage-is-mandatory)).

A construct with no rule here has no admitted rewrite yet: the module keeps
`.f.mjs` until the [roadmap](../spec/todo/README.md) lands the feature, and
the standing measurement of what holds each remaining module is in
[`todo/fjs-nanvm-integration.md`](../todo/fjs-nanvm-integration.md#current-leaf-migration-fixed-point).

Compound assignments to mutable identifiers need no rewrite: `n >>= 1n`,
`count += 1`, `value &&= next`, `value ||= fallback` and `value ??= fallback`
are admitted as statements
([variables](../spec/bindings/variables/README.md#compound-assignments)).
Source desugaring preserves right-operand evaluation order and the logical
forms' conditional evaluation and write. Property mutation, assignment
expressions and prefix/postfix updates remain separate constructs.

## 1. Computed keys

A key in brackets is one of two things, and the language treats them apart: a
key an **object literal defines**, `{ [k]: v }`, and a key an **access reads**,
`a[k]`.

### Defining: write the key as it is

An object literal takes any value between its brackets, converted as
JavaScript converts it
([property keys](../spec/values/objects/README.md#property-keys)): `{ [k]: 1 }`,
`{ [k + 'b']: 2 }` and `{ [i]: 3 }` are all in the language and need no
change. A constant string in brackets is the constant key, `{ ["a"]: 1 }` is
`{ a: 1 }`, and `{ [0]: 1 }` is `{ "0": 1 }`.

The one spelling to change is a **numeric key literal**, `{ 0: 1 }` or
`{ 3e7: true }`, which the language does not read yet
([roadmap](../spec/todo/README.md#22-priority-2)). Write it in brackets or as
the string it names:

```js
{ 0: 'a', 3e7: 'b' }          // refused
{ [0]: 'a', [3e7]: 'b' }      // the same object
{ "0": 'a', "30000000": 'b' } // the same object
```

### Reading: say what type the key has

An access with a constant key stays as it is: `a.b`, `a[0]`, `a["b"]`. Two
constants are the exceptions. A name a built-in prototype gives a value —
`toString`, `constructor`, `push` and the rest
[`fjs/js/prototype`](../fjs/js/prototype/module.f.js) lists, `length`
aside — is refused as a constant key in either spelling
(`prohibited property name`), even where the object owns the property:
`const o = { toString: 1 }` followed by `o.toString` does not compile. Where
the module reads an own property of such a name, `entry(o, "toString")`,
below, reads it. And a numeric literal that overflows, `a[1e400]`, passes
the check but names a key the FunctionalScript output refuses to write
(`a number key no literal reads back`); write the string it is,
`a["Infinity"]`, which JavaScript reads as the same key.

A key the module computes, `a[i]`, is refused (`computed key is not Number(...)`),
because the compiler does not know the key's type, and the type decides what
JavaScript would find
([property access](../spec/property-access/README.md)). The rewrite says
which it is.

**A number — an element of an array, a code unit of a string:** convert the
key, `a[Number(i)]`.

```js
const at = (xs, i) => xs[i]          // refused
const at = (xs, i) => xs[Number(i)]  // accepted
```

This is the rewrite where `i` is already a number: `Number(i)` is then `i`,
and the access reads the same element in both languages. Where `i` could be
a string, `Number` changes the key — `xs["x"]` reads the member `x` in
JavaScript, `xs[Number("x")]` reads `"NaN"` — so the rewrite is wrong there,
and the next form is the one to use. A number's string is never a prototype
name, so a converted key is never refused as one.

**Anything else — a member of an object by a string, or a key of unknown
type:** read it with the `entry` helper
([reading an entry at run time](../spec/property-access/entries/README.md)).
Its implementation is
[`fjs/types/object/entry`](../fjs/types/object/entry/module.f.js), an
authored `.f.js` the compiler accepts, and the import below is the whole of
what a module writes for it. The specification spells the function out
because the compiler recognizes it by its shape; a module does not restate
it.

```js
const escapes = { n: '\n', t: '\t' }
const escape = c => escapes[c]             // refused
```

```js
import { entry } from '../types/object/entry/module.f.js'

const escapes = { n: '\n', t: '\t' }
const escape = c => entry(escapes, c)      // accepted
```

`entry(a, k)` is the value of the enumerable own property `k` names of
`a`, and `undefined` where there is none; `hasEntry(a, k)`, from the same
module, is whether there is one, `true` for an entry holding `undefined`.
`entry(a, k)` is what `a[k]` reads on a plain object whose keys are its
own, `hasEntry(a, k)` is what `k in a` asks of such an object, and
`entry(a, k) ?? d` is `a[k] ?? d`; where the default must not replace an
entry holding `undefined`, `hasEntry(a, k) ? entry(a, k) : d` keeps it. It
differs from `a[k]` where JavaScript would reach past the own properties,
and a conversion checks that the module never did:

- `entry(a, "length")` is `undefined` on an array, a string or a function, whose
  `length` is own but not enumerable: a `length` is no entry. A module
  reads an entry with `entry(a, k)` and a length with `a.length`, and a
  read that could be either is two reads the module has run together, to
  be told apart in the conversion, not guarded around.
- `entry(a, "toString")` is `undefined`, where JavaScript finds the prototype's
  function. The language has no prototype chains, so a module that relied
  on one was never FunctionalScript; such a read is a change, not a
  rewrite.
- `entry(f, "name")` is `undefined` on a function, whose `name` JavaScript gives
  and the language keeps unobservable
  ([functions](../spec/functions/README.md)); `f.name` is refused outright.
  A module that read a function's name was never FunctionalScript either,
  and has no rewrite.
- `entry(a, k)` with a `null` or `undefined` `a` is an error, as `a[k]` is.

**A negative or non-finite literal**, `a[-1]`, `a[NaN]`: these are no
`Number(...)` and no constant the grammar reads, so write the string the key
is, `a["-1"]`, `a["NaN"]`. Both are `undefined` on an array, as in
JavaScript. The string is the one JavaScript's conversion gives, not the
source text: `a[-0]` is `a["0"]`, since `-0` converts to `"0"`, and
`a["-0"]` would name a different property. A grouped literal, `a[(0)]`, is
refused too; drop the group.

The `Number(...)` form applies to an optional access alike, `a?.[Number(i)]`
([optional chaining](../spec/property-access/optional-chaining/README.md)), and to a call
through the access, `a[Number(i)](x)`, which calls what it reads with `a` as
the receiver, as `a[0](x)` does. The `entry` form has no optional spelling:
`a?.[k]` is `undefined` where `a` is `null` or `undefined`, and `entry(a, k)`
is an error there, so the rewrite keeps the test the `?.` made:

```js
const read = (a, k) => a?.[k]                                              // refused
const read = (a, k) => a === null || a === undefined ? undefined : entry(a, k)  // accepted
```

JavaScript also leaves `k` unevaluated where `a` is nullish; a pure
expression evaluated or not is no observation, so the conditional reads the
same.

The test covers the **whole chain**, not the one access. In JavaScript a
nullish `a` short-circuits every step after the `?.`, so `a?.[k].x` is
`undefined`, never a read of `x` on `undefined`; the rest of the chain
therefore goes inside the non-nullish branch, and only what stands outside
the chain applies to the conditional's result:

```js
const read = (a, k) => a?.[k].x ?? 0                                                   // refused
const read = (a, k) => (a === null || a === undefined ? undefined : entry(a, k).x) ?? 0  // accepted
```

Written as `(… ? undefined : entry(a, k)).x`, the rewrite would read `x`
on `undefined` where the chain read nothing, and throw where it returned.

## 2. `Number.isInteger`

`Number.isInteger` is admitted, with `Number.isSafeInteger`,
`Number.isNaN` and `Number.isFinite`
([built-in static functions](../spec/built-ins/static-functions/README.md)),
so a module keeps each as written: the call, the function as a value, and
the destructuring `const { isInteger } = Number` alike. Nothing is
converted, and nothing is imported in its place: each body is the
runtime's ([`fjs/js/runtime`](../fjs/js/runtime/module.f.js)), a VM's to
bind and no module's to import, and the runtime's proof checks each
against the host's own built-in on every kind of value.

```js
const even = n => Number.isInteger(n) && n % 2 === 0   // accepted
```

The body of `Number.isInteger` is `typeof n === 'number' && n % 1 === 0`,
which is what the built-in answers, value for value — a non-number is
`false` without coercion, so is `NaN` and either infinity, whose remainder
is `NaN`, and both zeros and every integral number beyond the safe range
are `true`. `Number.isSafeInteger`'s is the same within the inclusive
bound `2^53 - 1` on either side, as the built-in is. The namespace's value properties,
`Number.MAX_SAFE_INTEGER` among them, are not admitted (`reserved word`),
and the bound is written as the number it is.

## 3. `Number.isNaN`

Admitted as `Number.isInteger` is, and kept as written. Its body is
`n !== n`: `NaN` is the one value not strictly equal to itself, so every
other number and every value of another type is `false`, without
coercion, which is what `Number.isNaN` answers.

It is not what the **global** `isNaN` answers, which converts first —
`isNaN("x")` is `true` in JavaScript, `isNaN(undefined)` too — and the
global stays refused (`const not found`), a decision of its own. A bare
`isNaN(x)` in a module being converted is therefore no `Number.isNaN(x)`:
on a value that is already a number it is `Number.isNaN(x)`; on anything
else the conversion changed the value there, so the module checks what it
meant.

## 4. `Number.isFinite`

The same again: admitted, kept as written, its body
`typeof n === 'number' && n * 0 === 0` — a finite number times `0` is `0`,
and `-0` is `0` under `===`; an infinity or `NaN` times `0` is `NaN`; and a
value of another type is `false` without coercion, as `Number.isFinite`
answers. The global `isFinite` converts first, as the global `isNaN` does,
`isFinite("1")` being `true` in JavaScript and `isFinite(null)` too, and
stays refused.

## 5. `Math.min` and `Math.max`

The `Math` global is not admitted: `Number` is a reserved word admitting
the conversion and the four predicates above, `Math` is no name at all, and `Math.min` is refused as
`const not found`. On two numbers the replacements are `min` from
[`fjs/types/number/min`](../fjs/types/number/min/module.f.js) and `max`
from [`fjs/types/number/max`](../fjs/types/number/max/module.f.js):

```js
const workers = count => Math.min(3, count)   // refused
```

```js
import { min } from '../types/number/min/module.f.js'

const workers = count => min(3, count)        // accepted
```

A plain `a < b ? a : b` is not the rewrite: it is not what `Math.min`
answers for `NaN`, which the built-in propagates, nor for the two zeros,
where `-0` is the lesser and `<` cannot tell them apart. `min` and `max`
answer both as the built-ins do, and their proofs compare every pair of
`NaN`, the infinities, the zeros and ordinary numbers against `Math.min`
and `Math.max`.

Two spellings of the built-in are not a call on two numbers. A variadic
call, `Math.max(...xs)`, is a reduce, `xs.reduce(max, -Infinity)`, the
identity being what `Math.max()` with no arguments is, and `Infinity` for
`min`. And the built-ins convert their arguments, `Math.min("1", 2)` being
`1`, where `min` and `max` take numbers: a call on anything else is
checked, not rewritten.

## 6. `Object.is` and `Object.entries`

`Object.is` is admitted
([built-in static functions](../spec/built-ins/static-functions/README.md)),
so a module keeps it as written: the call `Object.is(a, b)`, the function
as a value, and the destructuring `const { is } = Object` alike, which is
sugar for `const is = Object.is`. Nothing is converted.

Its body is the runtime's, as rule 2's are, SameValue: `===`, except on
the two values `===` reads the other way, and it is spelled from the two
tests that name them —
`a === b ? isNegativeZero(a) === isNegativeZero(b) : isNaN_(a) && isNaN_(b)`
— with `isNaN_` the body of rule 3 and `isNegativeZero` from
[`fjs/types/number/is_negative_zero`](../fjs/types/number/is_negative_zero/module.f.js),
which is `n === 0 && 1 / n < 0`, the zeros told apart through `1 / n` as
`min` and `max` tell them. The runtime's proof compares it on every pair
of a list spanning every type, the zeros, `NaN`, the bigint zero and two
containers of one shape, against the host's built-in.

The test for `-0` alone, `Object.is(x, -0)`, is the built-in's most common
use, and `isNegativeZero(x)` says it directly, where a module prefers the
name to the comparison:

```js
const sign = v => v < 0 || Object.is(v, -0) ? 1n : 0n        // accepted
```

```js
import { isNegativeZero } from '../types/number/is_negative_zero/module.f.js'

const sign = v => v < 0 || isNegativeZero(v) ? 1n : 0n       // accepted
```

`Object.entries` is admitted as well, and kept as written the same way,
`const { entries } = Object` included: what a module wrote on the host,
enumerating an object, compiles. Every other member of the namespace is
refused at the word (`reserved word`) — `Object.keys`, `Object.values`,
`Object.fromEntries` — and is a change the conversion makes by hand until
it is admitted on its own; `Object.keys(o)` is
`Object.entries(o).map(([k]) => k)`, and `Object.values(o)` the second of
each pair.

## 7. A body that ends without `return`

A block body ends in a terminating statement, a `return` or a `throw`, and
every statement before it is a `const` or a guard
([bodies and guards](../spec/control-flow/guards/README.md)). JavaScript lets
a body run off its closing brace and answers `undefined`; the compiler
refuses to infer that return, and reports the brace (`unexpected token`).
The rewrite spells the value JavaScript supplied:

```js
const check = (a, b) => {
    if (a !== b) { throw [a, b] }
}                                   // refused at the `}`
```

```js
const check = (a, b) => {
    if (a !== b) { throw [a, b] }
    return undefined                // accepted
}
```

The value is preserved exactly — the function returned `undefined` on that
path before, and returns it now — and the compiler lowers the body to the
conditional the guard already denotes, `a !== b ? (() => { throw [a, b] })()
: undefined`. The same rewrite closes a body whose last statement is a
`const`, and a guard's own block, `if (c) { return undefined }`, where the
guarded path is the one that answers nothing. A bare `return` is not the
spelling: `return` and its value share a line and the value is required, so
`return;` is refused as the brace was.

Such a body is nearly always a procedure — a proof that asserts by throwing,
as [`fjs/emergent_testing/example.f.js`](../fjs/emergent_testing/example.f.js)
does — and a module may find it reads better as an expression once the
`return` is written,
`(a, b) => a !== b ? (() => { throw [a, b] })() : undefined`. Either spelling
is in the language; the conversion adds the `return` and changes nothing
else.

A final literal `while (true)` with no source break targeting that loop needs
no trailing return: it is already a
[terminating statement](../spec/control-flow/loops/README.md#a-terminal-unconditional-loop).
Returning paths inside it still return explicitly, and other paths throw or
continue indefinitely. Breaks targeting an inner loop or switch do not change
that rule; a break targeting the final loop itself does, even when unreachable.
Ordinary function-body ends that can be reached still require an explicit
return as above.

## 8. `BigInt`

The `BigInt` global is not admitted, and `BigInt(n)` is refused
(`const not found`). On an integral number the replacement is `bigint`
from
[`fjs/types/bigint/from_number`](../fjs/types/bigint/from_number/module.f.js):

```js
const twoPow = exp => 1n << BigInt(exp)   // refused
```

```js
import { bigint } from '../types/bigint/from_number/module.f.js'

const twoPow = exp => 1n << bigint(exp)   // accepted
```

`bigint(n)` is the bigint with the value of `n`, exact at every magnitude:
the lowest bit of an integral double is `n % 2`, the bits above it are
those of `(n - n % 2) / 2`, both exact, and a `let`/`while` loop over one
variable ([loops](../spec/control-flow/loops/README.md)) reads them one per round, at
most 1024 for the largest double. `-0` gives `0n`, as
`BigInt(-0)` does. A fraction, `NaN` or an infinity has no bigint:
`BigInt` throws a `RangeError` on it, and `bigint` throws too
([failure is one outcome](../spec/principles/README.md#failure-is-one-outcome)), so
the rewrite preserves the failure with the value. It is a function the
compiler compiles, with no node of its own, as the strategy above says;
the language may take `BigInt(n)` in as sugar for it later, beside
`Number(n)` and `String(n)`.

One spelling of the built-in is not a call on a number. `BigInt("12")` is
`12n` and `BigInt(true)` is `1n`: the built-in converts its argument,
where `bigint` takes a number and throws on anything else, so a call on a
value of another type is checked, not rewritten — the module says what it
converts, as it does for `min` and `max` on strings.

## 9. A `Map` or a `Set` of strings

`Map` is not a language type, and `new Map(...)` is refused
(`unexpected token`). A `Map` earns its place only where the keys are not
strings — a function, an object, a value compared by identity — and stays
the module's until the language has a type for that; the
[`edag/analysis`](../fjs/edag/analysis/module.f.mjs) walk's `visited`,
keyed by EDAG nodes through
[`types/map`](../fjs/types/map/module.f.mjs), is one. A `Map` whose keys
are strings is an object the module already has, read through `entry` and
`hasEntry` (rule 1):

```js
const { entries } = Object

const same = (a, b) => {
    const bm = new Map(entries(b))                       // refused
    return entries(a).every(([k, v]) => bm.has(k) && bm.get(k) === v)
}
```

```js
import { entry, hasEntry } from '../types/object/entry/module.f.js'

const { entries } = Object

const same = (a, b) =>                                   // accepted
    entries(a).every(([k, v]) => hasEntry(b, k) && entry(b, k) === v)
```

The value is preserved: `new Map(entries(b))` holds the enumerable own
string-keyed properties of `b`, which are the entries `hasEntry` and
`entry` read, and `bm.size` is `entries(b).length`. `bm.has(k)` and
`hasEntry(b, k)` both answer `true` for an entry holding `undefined`, which
`entry(b, k) !== undefined` would not. A `Map` built to make a lookup cheap
is an optimization, and the module drops it with the `Map`
([DESIGN.md §1](./DESIGN.md#1-simplicity-first)).
[`fjs/types/object/structurally_same`](../fjs/types/object/structurally_same/module.f.js)
is the worked case.

A `Set` follows the same line: `new Set(...)` is refused as `new Map(...)`
is, and a `Set` of strings needs no collection at all. Built to ask whether
a list repeats, it is the question asked of the list itself — each item
first appears at its own index — and built to ask whether a string is in
it, `includes`:

```js
const unique = names => new Set(names).size === names.length    // refused
const has = (names, x) => new Set(names).has(x)                 // refused
```

```js
const unique = names => names.every((n, i) => names.indexOf(n) === i)   // accepted
const has = (names, x) => names.includes(x)                             // accepted
```

The value is preserved for strings, which `===`, `indexOf` and `includes`
tell apart exactly as a `Set` does: `'1'` and `'01'` are two, `'__proto__'`
is a string like any other, and `''` is one. `unique` is quadratic where
the `Set` was linear, the optimization the module drops with it.
[`fjs/ebnf/token_symbol`](../fjs/ebnf/token_symbol/module.f.js), whose
`encoding` refuses a repeated name, is the worked case.

## 10. A call made for its failure

A call written as a statement, `assert(a > 0);`, converts as written: it is a
call statement, evaluated where it stands and its value discarded
([call statements](../spec/functions/call-statements/README.md)). Such a call is made
for the one thing a discarded call can do in a pure language, fail, and the
statement keeps its place among the others, so a converted module throws the
error it threw before.

**A statement begins with a name.** One that opens with `(` or `[`,
`(0, o.f)(x);`, is refused, since JavaScript would read it as continuing the
statement before; the call goes into the statement directly after it, or a
`const` holds it, `const r = (0, o.f)(x);`. A statement that is no call,
`a.b;`, made only for the read's failure, is spelled as a `const` or as a comma
operand. Where no statement can stand, in an expression body, the comma
operator is the spelling ([comma](../spec/operators/comma/README.md)):

```js
const ok = r => (assert(r[0] === 'ok', r), r[1])
```

**The order is kept.** A converted module still runs as JavaScript, where
which of two failing calls throws first is observable, and a conversion
changes no behaviour, so a call keeps its place among the statements: a call
statement stays where it is, and a call the comma takes in — one a statement
opening with `(` made — moves into the statement directly after it, and never
past one, `(0, o.check)(n); if (n === 0) { return 0 }` becoming
`if (((0, o.check)(n), n === 0)) { return 0 }`. Moving the call past a `const`
would establish the `const` first; the failure contract would admit it
([failure is one outcome](../spec/principles/README.md#failure-is-one-outcome)),
but a JavaScript caller would see the other error. A refactoring may reorder
the assertions, as a change of its own, and the compiler's output may establish
them in any order; a conversion does neither.

TypeScript narrows after the call statement, the form an `asserts v` signature
is written for, and after a comma's discarded operand, which it follows into
the value after it — not after `const _ = assert(…)`, which binds a name nothing
reads, nor through `[assert(…), value][1]`, which builds an array to read one
item of.

## 11. `Array.from` used to generate by index

`Array.from({ length: n }, (_, i) => f(i))` constructs a dense array by
index; it does not need an iterable. Import `generate` from
[`fjs/types/array/generate`](../fjs/types/array/generate/module.f.js):

```js
const squares = n => Array.from({ length: n }, (_, i) => i * i)   // refused
```

```js
import { generate } from '../types/array/generate/module.f.js'

const squares = n => generate(n, i => i * i)   // accepted
```

The rewrite preserves behavior when `n` is an integer from `0` through
`0xffff_ffff`, the JavaScript array-length range, and the callback only
needs the index. Both create a dense array, including entries whose value
is `undefined`, and call the callback once per index in ascending order.
Zero, including negative zero, creates a fresh empty array without calling
the callback. Callback failures propagate.

`generate(n, f)` passes just the index to `f`; `Array.from` passes an item
value and then its index. Keep that adaptation explicit when converting
a named callback. This rule applies to the `{ length: n }` generator form;
an iterable, other array-like properties, or a `thisArg` needs its own
conversion.

`generate` rejects lengths outside its integer range rather than coercing
or rounding them: `Array.from({ length: 2.5 }, ...)` makes two elements,
and `Array.from({ length: -1 }, ...)` makes none. The existing
`repeat(n)(value)` helper rounds positive fractions up, so it is not a
direct replacement for arbitrary `Array.from` lengths either.

The implementation repeats a singleton placeholder array with
[`monoid.repeat`](../fjs/common/monoid/repeat/module.f.js), then maps the
indices. It and [`array/repeat`](../fjs/types/array/repeat/module.f.js)
have compiler-compatible runtime dependencies, independent of list folding.
