## Round to binary64's exponent range, not just 53 bits

**Priority:** P3
**Status:** open

### Problem

`decToBin` (`fjs/types/bigfloat/module.f.mjs`) rounds a decimal to a mantissa
of exactly 53 significant bits and leaves the exponent unbounded. That is the
whole of IEEE-754 binary64's *significand*, and none of its *exponent range*:

- **Subnormals.** Below `2^-1022` a `double` no longer has 53 bits to spend —
  at the bottom of the range it has one, and every value is a multiple of
  `2^-1074`. `decToBin` still hands back 53 bits, so a consumer has to round a
  second time to reach the grid the value will actually live on. Two roundings
  are not one rounding: the first can move the value exactly onto a subnormal
  midpoint that the true value only approached, and ties-to-even then breaks
  that manufactured tie in the wrong direction.
- **Overflow.** A magnitude past `(2^53 - 1) * 2^971` is not representable at
  all and should become an infinity. `decToBin([1n, 400])` returns
  `[7686445155841023n, 1276]` — a perfectly good 53-bit answer to a question
  binary64 cannot be asked.

The subnormal case is not theoretical. Take the value one part in `2^126`
below the midpoint between the subnormals `3 * 2^-1074` and `4 * 2^-1074`,
written exactly as a decimal:

```js
const mantissa = (7n * 2n ** 125n - 1n) * 5n ** 1200n   // dyadic → exact in decimal
decToBin([mantissa, -1200])
// => [7881299347898368n, -1125]  === 7 * 2^-1075 === exactly 3.5 * 2^-1074
```

The input is strictly below the midpoint, so the correctly-rounded `double` is
`3 * 2^-1074` — which is what `Number(...)` returns for the same decimal.
`decToBin`'s result *is* the midpoint, and rounding it onto the subnormal grid
with ties-to-even goes up to `4 * 2^-1074`, because 3 is odd. One ulp wrong,
and no amount of care in the consumer can recover it: the information that the
true value was below the midpoint was destroyed by the first rounding.

Nothing consumes `decToBin` today, so nothing is wrong in the tree right now.
The point is that the function cannot be *made* into a correct
decimal→`number` conversion by any wrapper — the fix has to be inside, where
the remainder is still available.

### Proposal

Correct conversion rounds **once**, to a precision chosen from the target
exponent rather than fixed at 53. Parameterize the existing pipeline by a
target format instead of hardcoding binary64's significand width:

```js
/** @typedef {{ readonly precision: number, readonly minExp: number, readonly maxExp: number }} Format */

const binary64 = { precision: 53, minExp: -1074, maxExp: 971 }
```

- Generalize `round53`/`renormalize53` to `round`/`renormalize` taking
  `precision`, replacing the `twoPow53`/`twoPow54` constants with
  `1n << BigInt(precision)` and `1n << BigInt(precision + 1)`. The carry
  re-normalization this issue's predecessor added is precision-independent
  and carries over unchanged.
- Before rounding, derive the precision actually available at the result's
  magnitude: `min(precision, exponent - minExp + precision)` clamped at 0 —
  i.e. full precision above `minExp + precision`, shrinking to zero at the
  bottom of the subnormal range. Round to *that* many bits, once.
- Above `maxExp`, report overflow. `Nullable<BigFloat>` (a `try*`-shaped
  result per AGENTS.md §5.6) is the likely shape, leaving the caller to
  produce an infinity — `BigFloat` has no encoding for one.
- `decToBin` stays as the unbounded-exponent entry point (it is the honest
  answer when the target is not a `double`) and becomes the `precision: 53`,
  no-clamping case of the general function.

Deciding the exponent-available-precision formula is the substantive part;
the rest is threading a parameter. It should be settled against a table of
boundary cases before implementation — `minExp` exactly, `minExp + 52`,
`maxExp` exactly, and the midpoint case above — not derived once in code.

### Tasks

- [ ] Decide the `Format` shape and whether `minExp`/`maxExp` are stated as
      the ulp exponent (`-1074`) or the normal-range exponent (`-1022`); they
      differ by the precision and mixing them up is the whole bug class here.
- [ ] Generalize `round53`/`renormalize53` over `precision`.
- [ ] Implement the available-precision computation and round once through it.
- [ ] Decide the overflow signal (`Nullable<BigFloat>` vs. a saturating
      sentinel) and whether underflow-to-zero needs its own.
- [ ] Proofs: the midpoint case above must round *down*, plus `minExp`,
      `minExp + 52`, and `maxExp` boundaries in both signs. Cross-check a
      corpus against `Number(decimalString)`, which is correctly rounded.
- [ ] Document the guarantees in `decToBin`'s JSDoc, replacing the note that
      currently records this gap.

### Related

- `fjs/types/bigfloat/module.f.mjs` — `round53`, `decToBin`, and the JSDoc
  note describing the gap.
- [from-decimal](from-decimal.md) — the preceding stage of the same pipeline;
  a decimal→`number` conversion needs both.
