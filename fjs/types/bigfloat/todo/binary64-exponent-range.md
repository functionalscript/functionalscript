## Map `decToBin` onto the binary64 exponent range

**Priority:** P3
**Status:** open

### Problem

`decToBin` (`fjs/types/bigfloat/module.f.mjs`) rounds the mantissa to 53 bits
and stops there. It never looks at the exponent, so nothing in it models
binary64's exponent range: no overflow to infinity, no underflow to zero, and
no denormalization. It returns a *normalized* pair at every scale.

That is exactly right for the normal range (biased exponent `0x001`..`0x7fe`),
where a binary64 significand is 53 bits. It is not the encodable significand
anywhere else:

| input      | `decToBin`                       | the actual double        |
| ---------- | -------------------------------- | ------------------------ |
| `1e-310`   | `[0x12_688b_70e6_2b10n, -1082]`  | field `0x000`, 45 bits   |
| `1e-320`   | `[0x1f_a017_12e8_f047n, -1116]`  | field `0x000`, 11 bits   |
| `5e-324`   | `[0x10_3132_b9cf_541cn, -1126]`  | field `0x000`, 1 bit     |
| `1e-400`   | `[0x12_bfcf_c0f9_23dfn, -1381]`  | field `0x000`, `0` (underflow) |
| `1e400`    | `[0x1b_4ec7_f919_73ffn, 1276]`   | field `0x7ff` (infinity) |

In the whole `0x000` range `decToBin` carries *more* precision than the value
it is converting to can hold, and at the top it hands back a finite pair where
binary64 has already saturated.

### The trap: a second rounding double-rounds

The obvious way to finish the job — take `decToBin`'s output and shift it onto
the subnormal grid (multiples of `2^-1074`) — rounds a second time, and the two
roundings do not compose. Constructed counter-example: let `q = 2^44 + 1` (odd,
45 bits) and let the input be the exact decimal for `((2q + 1) << 80) - 1`
over `2^1155` — a value just *below* the tie point between `q` and `q + 1` on
the subnormal grid.

- The correctly-rounded double is `q` (`0x100000000001`); `Number()` agrees.
- `decToBin` rounds it up to the tie point exactly — `[0x10_0000_0000_0180n,
  -1082]` — and grid-rounding that tie half-to-even, with `q` odd, goes *up* to
  `0x100000000002`.

One ulp off, and no amount of care in the second step recovers it: the
information that decides the case was discarded by the first rounding. A
correct implementation has to round once, directly to the target precision.

### Proposal

Decide first whether this belongs in `decToBin` at all. Two shapes:

1. **A separate `toBinary64`** that takes the decimal `BigFloat` and rounds
   once to the binary64 grid — normal, subnormal, and saturating cases — while
   `decToBin` keeps its current unbounded-exponent contract for callers that
   want the exact normalized pair. The precision to round to is a function of
   the exponent, so this is one rounding with a computed bit budget, not
   `decToBin` followed by a fixup.
2. **A range-limited `decToBin`**, which makes the current unbounded behavior
   unreachable. Only worth it if no caller ever wants the exact pair.

Option 1 looks right: the unbounded pair is the more primitive result, and
`round53` already has the shape a variable bit budget needs — it is
`decreaseMantissa` to a bound, then one rounding decision. Generalizing that
bound from `twoPow54` to a computed one is the core of the work.

Whichever is chosen, the postcondition documented on `decToBin` must stay
honest about which range it covers.

### Tasks

- [ ] Decide between a separate `toBinary64` and a range-limited `decToBin`.
- [ ] Generalize `round53`'s fixed 54-bit budget to a computed one so the
      subnormal case rounds exactly once.
- [ ] Handle saturation: overflow to infinity and underflow to zero, including
      the half-way cases at both boundaries.
- [ ] Proofs: the double-rounding construction above, every subnormal width
      from 1 to 52 bits, both boundaries, and both signs. `Number(string)` is a
      correctly-rounded oracle and can be compared against exactly.
- [ ] Update the `decToBin` JSDoc once the range is covered.

### Related

- [from-decimal](from-decimal.md) — the other missing half of the same
  pipeline: decimal literal → `BigFloat`, before this stage.
- `fjs/types/bigfloat/module.f.mjs` — `decToBin`, `round53`,
  `decreaseMantissa`.
