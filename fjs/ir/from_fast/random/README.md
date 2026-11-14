# Seeded random comparison

A host proof that generates FunctionalScript in the part of the language
the [slices](../../todo/slices.md) lower so far, takes each program through
normalized FAST, the lowering, the
[lifetime pass](../../lifetime/module.f.js), the checker and the emitter,
and runs the WASM against the same body as JavaScript, with every cell of
the host as it found it after each call that answers.

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
| typed | floats, booleans, small integer ranges, an unexported helper, a short loop, `%`, a record kept inside the function |
| any | `kind`, `asBoolean`, `asNumber`, `length` and `unit`, over values of every kind; since 6b, `concat`, `fromUnit`, `substring` and `item`, whose values the caller owns, and a loop that owns its string |

A program whose **integer** signature's body range past that signature the
checker refuses is counted and not run. The same diagnostic against an
`f64` or `bool` signature is a failure, so a regression that gives an
integer body where a float or bool was declared fails the proof. Any other
refusal is a failure too. Where JavaScript throws, the comparison accepts
any trap, as [`testlib.mjs`](../../wasm/testlib.mjs) does today; a stricter
match of traps waits until slice 7 makes throws meaningful.

Prefer `node --test` for [`proof.mjs`](./proof.mjs).
