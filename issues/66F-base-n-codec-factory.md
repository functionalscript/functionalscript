# 66F-base-n-codec-factory. Extract a shared `base_n` bit-codec factory for `base64` and `cbase32`

**Priority:** P3
**Status:** open

## Problem

`fs/base64/module.f.ts` and `fs/cbase32/module.f.ts` now contain the **same two
inner loops**, differing only in the chunk width (`6n` vs `5n`), the alphabet,
and an optional character-normalization step. The padding strategies differ
(base64 uses `=` octet-alignment, cbase32 uses a stop-bit sentinel), but the raw
`Vec → string` and `string → Vec` conversions underneath are identical.

### Encode loop

```ts
// fs/base64/module.f.ts:25-29
while (length(v) > 0n) {
    const [r, rest] = popFront6(v)
    result += alphabet[Number(r)]
    v = rest
}
```

```ts
// fs/cbase32/module.f.ts:18-28  (vec5xToCBase32)
while (true) {
    const len = length(v)
    if (len === 0n) { break }
    const [r, rest] = popFront5(v)
    result += m[Number(r)]
    v = rest
}
```

Same algorithm: pop a fixed-width chunk from the MSB front, index it into the
alphabet, append the character, repeat until empty.

### Decode loop

```ts
// fs/base64/module.f.ts:47-52
let result: Vec = empty
for (const c of body) {
    const index = alphabet.indexOf(c)
    if (index < 0) { return null }
    result = concat(result)(vec6(BigInt(index)))
}
```

```ts
// fs/cbase32/module.f.ts:52-61  (cBase32ToVec5x)
let result: Vec = empty
for (const c of s) {
    const index = toCrockfordIndex(c)   // = m.indexOf(normalizeChar(c))
    if (index < 0) { return null }
    const v = vec5(BigInt(index))
    result = concat(result)(v)
}
```

Same algorithm: for each character, look up its index (cbase32 first normalizes
the character), reject on a negative index, and append a `vec(width)(index)`
chunk to the accumulator.

## Why this is the right time

[i039-radix-encoding](./039-radix-encoding.md) explicitly deferred this
extraction with a YAGNI gate:

> The only existing `Vec → string` consumer is `cas/` (which uses `cbase32`) …
> When a second real consumer appears, extract a shared `base_n(alphabet,
> normalize?)` factory at that point — `cbase32` is the reference
> implementation.

`fs/base64` is now that second consumer, so the gate is cleared. This is the
DRY-by-second-consumer rule from `AGENTS.md` (extract only once the second real
consumer exists), and it is now satisfied.

## Proposal

Add a factory — `fs/types/bit_vec/` already owns `Vec`, so a sibling module such
as `fs/types/bit_vec/base_n/module.f.ts` (or a small `fs/base_n/module.f.ts`) is
the natural home:

```ts
export const baseN = (bits: bigint, alphabet: string, normalize?: (c: string) => string) => {
    const popFrontN = msb.popFront(bits)
    const vecN = vec(bits)
    const toIndex = normalize === undefined
        ? (c: string) => alphabet.indexOf(c)
        : (c: string) => alphabet.indexOf(normalize(c))
    // vecNxToString: the encode loop above, parameterized by popFrontN + alphabet
    // stringToVecNx: the decode loop above, parameterized by toIndex + vecN
    return { vecNxToString, stringToVecNx }
}
```

Each module keeps its own **padding** logic (the genuinely different concern)
and delegates only the raw codec:

- `base64`: `baseN(6n, alphabet)` — wrap with octet-alignment check + `=`
  padding on encode, `=` stripping + zero-bit verification on decode.
- `cbase32`: `baseN(5n, m, normalizeChar)` — `vec5xToCBase32` /
  `cBase32ToVec5x` become the factory's `vecNxToString` / `stringToVecNx`,
  while `vecToCBase32` / `cBase32ToVec` keep the stop-bit sentinel logic.

This separates two concerns that are currently entangled: the **alphabet ↔
bit-width codec** (shared) and the **end-of-stream padding scheme** (per
format).

## Tasks

- [ ] Add the `baseN` factory module and register it in `deno.json` `exports`.
- [ ] Add `proof.f.ts` with 100% coverage (both `normalize` present/absent
      branches, round-trips, invalid-character rejection).
- [ ] Rewrite `base64` encode/decode to use the factory, keeping the `=` padding
      wrapper.
- [ ] Rewrite `cbase32` `vec5xToCBase32` / `cBase32ToVec5x` to use the factory,
      keeping the stop-bit padding wrapper.
- [ ] Confirm `fjs t` and `npx tsc` still pass.

## Related

- [i039-radix-encoding](./039-radix-encoding.md) — anticipated this factory;
  this issue is its now-unblocked extraction step.
- [i66E-base64](./66E-base64.md) — added the second consumer that clears the
  YAGNI gate.
- [i178-cbase32-bit-vec-padding](./178-cbase32-bit-vec-padding.md) — the
  cbase32 padding concern that stays out of the shared factory.
