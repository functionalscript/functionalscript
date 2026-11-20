# Seeded random comparison

A host proof that generates FunctionalScript in the part of the language
the [slices](../../todo/slices.md) lower so far, takes each program through
normalized FAST, the lowering, the
[lifetime pass](../../lifetime/module.f.js), the checker and the emitter,
and runs the WASM against the same body as JavaScript, with every cell of
the host as it found it after each call that answers, or, where the module
has string literals or constants, as its start function and `init` left
it.

It is the first pull request of slice 6: it found the three refusal defects
that example proofs at 100% coverage missed (#3837), and it stays as each
later slice extends what the generators write.

```js
import { compare } from './module.mjs'

const out = compare(0x4f1c_5e2d, 120, 80)
// out.wrong === null, out.ran and out.calls > 0
```

## What it covers

| Generator | Writes |
| --- | --- |
| typed | floats, booleans, small integer ranges, an unexported helper, a short loop, `%`, a record kept inside the function; since 6c, module constants of floats, each reading the ones before it, and a `bool` of two of them |
| any | `kind`, `asBoolean`, `asNumber`, `length` and `unit`, over values of every kind; since 6b, `concat`, `fromUnit`, `substring` and `item`, whose values the caller owns, and a loop that owns its string; since 6c, a constant of a string that `init` makes, and `undefined` and `null`; since 6d, string literals, the empty one, a unit past ASCII and a pair of surrogates among them, raw and escaped, at times one written twice and at times through a definition of the module; since 6e, array literals of parameters, literals, Any's constants, strings that `concat` makes and arrays, at times one that `init` builds, in the arms of a `kind` test, and read by `length` and `item` or answered; since 6f, a read of an array at a number key, `a[0]` or `a[Number(k)]`, at an index, past the end, at a fraction, a NaN and `-0`; since 7b, a throw where a value is of a kind; since 8b, `buildArray` of a count that may be no index, with arrow callbacks that step a number and answer a parameter, a literal, a string or an array that they make, or another `buildArray` of the state, at times in an arm of a `kind` test; since 8c, object literals of values of `any`, `{}` and nested ones among them, and `buildObject` of a count that may be no index, with keys that repeat, that a call makes or that `fromUnit` makes of the state; since 9a, numbers and booleans as items of an array literal; since 9b, `asFunction(f)(…)` of zero to three arguments, of functions that answer, count their arguments or throw, and of values that are no function |
| untyped | since 11a, a program that no table types, linked with L1: an expression over `a` and `b` of `+ - * /`, `< <= > >=`, `===` and `!==`, `!`, `-` and `typeof`, `?:`, `&&`, `\|\|` and `??`, `.length` and `.k`, `[0]` and `[1]`, `?.`, array literals and a field of an object literal, over parameters and literals of every kind, on pairs of values of every kind but functions, whose text is the runtime's |
| closure | since 11b, an untyped program that makes a function of `x` over `a` and `b`, of such an expression: one that it returns, which the judge calls on probes of its own, or one that it passes to a function that it calls through a value, `(g => g(c))(x => e)` |

A program whose **integer** signature's body range past that signature the
checker refuses is counted and not run. The same diagnostic against an
`f64` or `bool` signature is a failure, so a regression that gives an
integer body where a float or bool was declared fails the proof. Any other
refusal is a failure too. Slice 10's `get` and operators run on the
whole L1 module against L1's own on the parity table, in
[`../proof.mjs`](../proof.mjs), and since 11a, the untyped forms call
them, linked into the same module. A call of a function that throws leaves its
arguments array behind, which the host's `recover` frees, and only that
form says so. Since 7a, each call is judged as
[`testlib.mjs`](../../wasm/testlib.mjs) judges one, by three outcomes:
the same value, a throw of the same value, or a trap of both, where the
body traps as JavaScript by a misuse of the L0 view, which throws a reason
that starts with `l0.`. Since 11a, where JavaScript throws an error of its
own, a `TypeError` say, the program must throw L1's value of that error,
whose text starts with `TypeError: `; an untyped form says that a throw
may leave behind what its caller made for L1, a boxed number.

Prefer `node --test` for [`proof.mjs`](./proof.mjs).
