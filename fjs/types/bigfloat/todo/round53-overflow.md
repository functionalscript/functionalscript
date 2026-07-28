## round53-overflow. `decToBin` returns a 54-bit mantissa when rounding carries

**Priority:** P3
**Status:** open

### Problem

`round53` (`fjs/types/bigfloat/module.f.ts`) reduces the mantissa to 54 bits
with `decreaseMantissa(...)(twoPow54)`, then rounds to 53 bits by adding the
dropped bit back:

```ts
const m53 = m54 >> 1n
const e53 = e54 + 1
...
return [m53 + o54, e53]
```

Neither return path re-normalizes after the addition. When `m54` is all
ones, `m53 = 2^53 - 1` and the round-up carries into a 54th bit, so the
result leaves the function with a mantissa of exactly `2^53` — one bit wider
than the 53 bits the function is named for.

Reproduced against the current implementation:

```ts
decToBin([18014398509481983n, 0])   // 2^54 - 1
// => [9007199254740992n, 1]        // mantissa = 2^53, 54 bits
decToBin([-18014398509481983n, 0])
// => [-9007199254740992n, 1]       // same, negative
```

The numeric value is correct (`2^53 * 2^1 = 2^54`); only the
representation is out of range. Neighbouring inputs behave:
`decToBin([18014398509481981n, 0])` returns a 53-bit mantissa. The carry
path is reachable from both branches of `decToBin` — the tie-to-even
branch (above) and the plain `m53 + o54` branch.

This matters because the whole point of `decToBin` is to produce the
IEEE-754 binary64 significand: a consumer that assumes `abs(m) < 2^53` (to
emit the significand field, to compare two `BigFloat`s by mantissa, or to
round-trip through a `number`) is wrong on exactly these inputs.

Nothing consumes `decToBin` today. `bigfloat` does have importers — the JSON,
DJS, and JS tokenizers (`fjs/media/json/tokenizer`, `fjs/djs/tokenizer`,
`fjs/js/tokenizer`) — but they take only `multiply` and the `BigFloat` type,
not the decimal→binary conversion, so no current caller can observe the
oversized mantissa. That is why this is P3 and not higher; it stops being
true the moment a tokenizer's `BigFloat` is converted for a `number`.

### Proposal

Re-normalize after rounding: if the rounded mantissa reaches `twoPow53`,
shift it right one bit and increment the exponent. The value is unchanged
(the dropped bit is always 0 at that point, since the mantissa is exactly
`2^53`), so no second rounding decision is needed.

Both `return` sites in `round53` need it — factor the fix into a single
helper applied to the result rather than duplicating the check.

The alternative — deciding that a 54-bit mantissa is an acceptable output
and documenting the postcondition as "value-correct, not normalized" — is
worse: it pushes normalization onto every future consumer, and the function
already normalizes on the way in.

### Tasks

- [ ] Add a post-rounding normalization step covering both `round53`
      return paths.
- [ ] Document the mantissa-width postcondition of `decToBin` in its JSDoc.
- [ ] Add proofs for the carry cases: `[18014398509481983n, 0]`, its
      negation, and a non-tie carry input; assert `abs(m) < 2^53` and that
      the value is unchanged. The check must be on the magnitude — `m < 2^53`
      is vacuous for a negative mantissa and would pass against the current
      broken result `-9007199254740992n`.
- [ ] `npx tsc`, `fjs t`.

### Related

- [GitHub issue #265](https://github.com/functionalscript/functionalscript/issues/265)
  — the original report.
- `fjs/types/bigfloat/module.f.ts` — `round53`, `decToBin`.
