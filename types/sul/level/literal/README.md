# SUL Literal Levels

Bijective encoding between finite words of level-k symbols and single symbols of level k+1,
for the first three literal SUL levels.

## Background

A SUL **level** defines a finite alphabet `[0, n)` and a bijection between valid words over
that alphabet and symbols of the next level. Each level's output alphabet is strictly larger
than its input alphabet, so every finite sequence of bits eventually collapses to a single
root symbol after enough levels.

Alphabet sizes grow rapidly. Starting from `n = 2` (binary):

| Level | `e` | `n = 2^e + 1` |
|-------|-----|---------------|
| 0     | —   | `2`           |
| 1     | `0` | `2`           |
| 2     | `2` | `5`           |
| 3     | `7` | `0x81`        |
| 4     | —   | `2^136 + 1`   |

Level 4 and beyond are too large for integer representation; they are handled by the
[hash level](../hash/README.md).

## Word structure

See the [SUL overview](../../README.md) for the full definition. In brief, a valid word
has the form `[s0, s1, ..., sk, t]` where `s0 > s1 > ... > sk` and `t >= sk`.

## Encoding

A word encodes to the integer index of that word in the lexicographic ordering defined
by the level's word structure. `sum(i)` gives the count of valid words whose first symbol
is ≤ `i`; it defines the offset boundaries used during both encoding and decoding.

Encoding is streaming: symbols are fed one at a time via `Level.encode`. The encoder
returns `undefined` while the strictly-decreasing prefix is still being accumulated, and
emits the output symbol exactly once when the terminating symbol `t` arrives.

```typescript
const { encode } = level2
let state = emptyEncodeState
for (const s of [3n, 1n, 2n]) {
    const [out, next] = encode(state)(s)
    state = next
    if (out !== undefined) { /* out is the level-3 symbol */ }
}
```

## Pre-built levels

| Export   | Input alphabet | Output alphabet size |
|----------|---------------|----------------------|
| `level1` | `{0, 1}`      | `5`                  |
| `level2` | `{0, …, 4}`   | `0x81`               |
| `level3` | `{0, …, 0x80}`| `2^136 + 1`          |

## Bit vector converters

`literal1ToVec`, `literal2ToVec`, and `literal3ToVec` decode a level-k symbol all the way
down to a canonical MSB bit vector by chaining the level decoders:

```
literal3ToVec(s) = flatten(decode3(s).map(
                    t => flatten(decode2(t).map(
                      u => decode1(u).map(bit => vec(1)(bit))))))
```

These are used by the [id module](../../id/README.md) to convert level-3 symbols
into fixed-width bit vectors for inline storage.

## References

- [levels.md](levels.md) — full encoding tables for levels 1–3 with cumulative counts
- [avg.md](avg.md) — derivation of average word length ($E \to e$ as $n \to \infty$)
- [SUL overview](../../README.md)
