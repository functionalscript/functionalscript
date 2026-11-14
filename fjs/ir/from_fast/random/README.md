# Seeded random comparison

A host proof that generates FunctionalScript in the part of the language
the [slices](../../todo/slices.md) lower so far, takes each program through
normalized FAST, the lowering, the checker and the emitter, and runs the
WASM against the same body as JavaScript.

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
| any | `kind`, `asBoolean`, `asNumber`, `length` and `unit`, over values of every kind |

A program the slices refuse — for example a product of two integer ranges
that needs more than one word — is counted and not run. Where JavaScript
throws, the comparison accepts any trap, as
[`testlib.mjs`](../../wasm/testlib.mjs) does today; a stricter match of
traps waits until slice 7 makes throws meaningful.

Prefer `node --test` for [`proof.mjs`](./proof.mjs).
