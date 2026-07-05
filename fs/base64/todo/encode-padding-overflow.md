## `encode` can silently produce an over-`maxLength` vector

**Priority:** P3
**Status:** open

### Problem

`encode` in `fs/base64/module.f.ts` pads the input up to a 6-bit boundary
before stringifying:

```ts
const rem = len % 24n
const padBits = rem === 0n ? 0n : 6n - rem % 6n
const v = padBits > 0n ? concat(input)(vec(padBits)(0n)) : input
let result = vecToString(v)
```

`concat` is `msb.concat` from `fs/types/bit_vec/module.f.ts`, which builds the
padded result via `pack(unpackConcat(au)(bu))` → `vec(length)(uint)`. `vec`
itself performs no `maxLength` check — that guard only lives in the
`tryListToVec` / `listToVec` list-folding path
(`fs/types/bit_vec/module.f.ts:301-369`), not in pairwise `concat`.

So if `input` is already at or within 5 bits of `maxLength`
(`fs/types/bit_vec/module.f.ts:46`), padding silently pushes the padded
vector's length past `maxLength`. `encode` then happily returns a string for
an over-limit vector instead of erroring — inconsistent with the rest of the
codec stack, where `tryListToVec` / `tryU8ListToVec` now cleanly reject
oversized inputs with `null` (see `fs/types/bit_vec/proof.f.ts`'s
`tryListToVecOverflow` / `u8ListToVecOverflow`). `maxLength`'s own doc comment
notes it exists to stay under Bun's `bigint` size constraint, so producing a
vector past that limit risks a runtime-level failure later, not just a logic
inconsistency.

### Proposal

Have `encode` check the padded length against `maxLength` (or check `input`
against `maxLength - 5n` up front, since padding adds at most 5 bits) and
return `null` instead of a string when it would overflow, matching the
`Nullable` convention `decode` already uses for its failure cases.

### Tasks

- [ ] Add a `maxLength` guard to `encode` in `fs/base64/module.f.ts` (before or
      after padding) and return `null` on overflow.
- [ ] Add a proof case exercising `encode` on an input within padding distance
      of `maxLength`, asserting `null`.
- [ ] Check `fs/cbase32/module.f.ts`'s `vec5xToCBase32`/padding for the same
      gap — it pads via the same `concat`-based pattern.

### Related

- `fs/types/bit_vec/todo/u8-list-to-vec-call-sites.md` — related overflow
  hardening: callers of `u8ListToVec`/`tryU8ListToVec` that should switch to
  the non-throwing variant.

The opposite-direction bug this issue was originally paired with — `decode`
over-rejecting valid, exactly-`maxLength`-sized input because its cap was
checked before padding bits were trimmed — is fixed. `bit_vec`'s
`tryListToVec` (and `baseN`'s `stringToVec`) now take an optional `cap`
parameter; `base64.decode` and `cbase32.cBase32ToVec` pass a cap widened by
their known padding so the raw pre-trim length isn't checked against
`maxLength` before the padding is stripped off.
