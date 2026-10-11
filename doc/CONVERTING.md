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

An access with a constant key stays as it is: `a.b`, `a[0]`, `a["b"]`. A key
the module computes, `a[i]`, is refused (`computed key is not Number(...)`),
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

- `entry(a, "length")` is `undefined` on an array or a string, whose
  `length` is own but not enumerable. A module that reads `length` through a
  computed key writes `a.length`.
- `entry(a, "toString")` is `undefined`, where JavaScript finds the
  prototype's function. The language has no prototype chains, so a module
  that relied on one was never FunctionalScript; such a read is a change,
  not a rewrite.
- `entry(a, k)` with a `null` or `undefined` `a` is an error, as `a[k]` is.

**A negative or non-finite literal**, `a[-1]`, `a[NaN]`: these are no
`Number(...)` and no constant the grammar reads, so write the string the key
is, `a["-1"]`, `a["NaN"]`. Both are `undefined` on an array, as in
JavaScript. A grouped literal, `a[(0)]`, is refused too; drop the group.

The two access rewrites apply to an optional access alike, `a?.[Number(i)]`
([optional chaining](../spec/README.md#optional-chaining)), and the
`Number(...)` form to a call through the access, `a[Number(i)](x)`, which
calls what it reads with `a` as the receiver, as `a[0](x)` does.

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
