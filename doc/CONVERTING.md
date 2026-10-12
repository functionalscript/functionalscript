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
  function — `entry` and `isInteger` below, and the helpers later rules
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
  imports it depends on nothing but the module.
- **The value is preserved.** FunctionalScript is a subset of JavaScript, and
  a converted module is still JavaScript: it must compute what it computed
  before, in both languages. A rewrite that changes a result is a change to
  the module, reviewed as one, never part of a conversion.
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

## 1. Computed keys

A key in brackets is one of two things, and the language treats them apart: a
key an **object literal defines**, `{ [k]: v }`, and a key an **access reads**,
`a[k]`.

### Defining: write the key as it is

An object literal takes any value between its brackets, converted as
JavaScript converts it
([property keys](../spec/README.md#property-keys)): `{ [k]: 1 }`,
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
([property access](../spec/README.md#property-access)). The rewrite says
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
([reading an entry at run time](../spec/README.md#reading-an-entry-at-run-time)).
Its implementation is
[`fjs/types/object/entry`](../fjs/types/object/entry/module.f.js), an
authored `.f.js` the compiler accepts, and the import below is the whole of
what a module writes for it. The specification spells the function out
because the compiler recognizes it by its shape; a module does not restate
it. [`fjs/js/entry`](../fjs/js/entry/module.f.js) is a compatibility
re-export of the same function, not a second one to choose from.

```js
const escapes = { n: '\n', t: '\t' }
const escape = c => escapes[c]          // refused
```

```js
import { entry } from '../types/object/entry/module.f.js'

const escapes = { n: '\n', t: '\t' }
const escape = c => entry(escapes, c)   // accepted
```

`entry(a, k)` is the **enumerable own property** `k` names of `a`, and
`undefined` where there is none, which is what `a[k]` reads on a plain object
whose keys are its own. It differs from `a[k]` where JavaScript would reach
past the own properties, and a conversion checks that the module never did:

- `entry(a, "length")` is `undefined` on an array, a string or a function,
  whose `length` is own but not enumerable: a `length` is no entry. A
  module reads an entry with `entry(a, k)` and a length with `a.length`,
  and a read that could be either is two reads the module has run together,
  to be told apart in the conversion, not guarded around.
- `entry(a, "toString")` is `undefined`, where JavaScript finds the
  prototype's function. The language has no prototype chains, so a module
  that relied on one was never FunctionalScript; such a read is a change,
  not a rewrite.
- `entry(f, "name")` is `undefined` on a function, whose `name` JavaScript
  gives and the language keeps unobservable
  ([functions](../spec/README.md#functions)); `f.name` is refused outright.
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
([optional chaining](../spec/README.md#optional-chaining)), and to a call
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

Of the `Number` global, only the call `Number(exp)` is in the language
([number conversion](../spec/README.md#number-conversion)); every member
of it is an admission of its own, and `Number.isInteger` is refused
(`reserved word`). Its replacement is `isInteger`, imported from
[`fjs/types/number/is_integer`](../fjs/types/number/is_integer/module.f.js):

```js
const even = n => Number.isInteger(n) && n % 2 === 0   // refused
```

```js
import { isInteger } from '../types/number/is_integer/module.f.js'

const even = n => isInteger(n) && n % 2 === 0           // accepted
```

`isInteger(n)` is `typeof n === 'number' && n % 1 === 0`, which is what
`Number.isInteger` answers, value for value: a non-number is `false` without
coercion, so is `NaN` and either infinity, whose remainder is `NaN`, and
both zeros and every integral number beyond the safe range are `true`. The
module is an ordinary function the compiler compiles, not a helper it
recognizes; it needs no node of its own.

`Number.isSafeInteger` has the same rewrite, `isSafeInteger` from
[`fjs/types/number/is_safe_integer`](../fjs/types/number/is_safe_integer/module.f.js),
which is `isInteger` within the inclusive bound `2^53 - 1` on either side,
as the built-in is.

## 3. `Number.isNaN`

Refused as `Number.isInteger` is, and replaced the same way, by `isNaN_`
from [`fjs/types/number/is_nan`](../fjs/types/number/is_nan/module.f.js):

```js
const canonical = v => Number.isNaN(v) ? 0 : v   // refused
```

```js
import { isNaN_ } from '../types/number/is_nan/module.f.js'

const canonical = v => isNaN_(v) ? 0 : v         // accepted
```

`isNaN_(n)` is `n !== n`: `NaN` is the one value not strictly equal to
itself, so every other number and every value of another type is `false`,
without coercion, which is what `Number.isNaN` answers. It is not what the
**global** `isNaN` answers, which converts first — `isNaN("x")` is `true`
in JavaScript, `isNaN(undefined)` too.

The trailing `_` keeps the two apart. JavaScript has a global `isNaN`, so
a helper of that name would shadow it: a bare `isNaN(x)` left in a module
being converted would silently become the helper's call, and its value
would change where `x` is not a number. Under its own name the helper
shadows nothing, a bare `isNaN(x)` stays the global's call, and the
compiler goes on refusing it (`const not found`) until the module deals
with it: on a value that is already a number it takes the rewrite as it is;
on anything else the conversion changed the value there, so the module
checks what it meant. The name is also one the language can reserve, as it
reserves `Number`, so that no module binds a `const isNaN_` of its own
([`fjs/compiler/todo/reserve-helper-names.md`](../fjs/compiler/todo/reserve-helper-names.md)).

## 4. `Number.isFinite`

The same again: `isFinite_` from
[`fjs/types/number/is_finite`](../fjs/types/number/is_finite/module.f.js),
named with the `_` for the same reason, the global `isFinite` converting
first as the global `isNaN` does, `isFinite("1")` being `true` in
JavaScript and `isFinite(null)` too.

```js
const retryAt = after => Number.isFinite(after) ? after : null   // refused
```

```js
import { isFinite_ } from '../types/number/is_finite/module.f.js'

const retryAt = after => isFinite_(after) ? after : null         // accepted
```

`isFinite_(n)` is `typeof n === 'number' && n * 0 === 0`: a finite number
times `0` is `0`, and `-0` is `0` under `===`; an infinity or `NaN` times
`0` is `NaN`; and a value of another type is `false` without coercion, as
`Number.isFinite` answers.

## 5. `Math.min` and `Math.max`

The `Math` global is not admitted: `Number` is a reserved word with one
admitted call, `Math` is no name at all, and `Math.min` is refused as
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

## 6. `Object.is`

The `Object` namespace is not admitted outside the `entry` helper
([reading an entry](../spec/README.md#reading-an-entry-at-run-time)), so
`Object.is` is refused (`const not found`), and so is the destructuring
`const { is } = Object`. The replacement is `is` from
[`fjs/types/object/is`](../fjs/types/object/is/module.f.js):

```js
const sign = v => v < 0 || Object.is(v, -0) ? 1n : 0n   // refused
```

```js
import { is } from '../types/object/is/module.f.js'

const sign = v => v < 0 || is(v, -0) ? 1n : 0n           // accepted
```

`is(a, b)` is SameValue, as `Object.is` is: `===`, except that `NaN` is
itself and `0` is not `-0`. It is spelled with the operators the language
has and the helper of rule 3 —
`a === b ? a !== 0 || 1 / a === 1 / b : isNaN_(a) && isNaN_(b)`, the zeros
told apart through `1 / a` as `min` and `max` tell them — and its proof
compares every pair of a list spanning every type, the zeros, `NaN`, the
bigint zero and two containers of one shape, against the built-in. A
module that read `is` off the namespace with `const { is } = Object` imports
the same function under the same name, and changes nothing else.

The EDAG has no node for it: the function is the one spelling, as the
strategy above says, and the language may take `Object.is(a, b)` in as
sugar for it later. Until then `Object` stands in a module only as the
helper's descriptor, and every other member of it is a change the
conversion makes by hand.
