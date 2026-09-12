## framed-hash-record. `sha1` hand-rolls the record `sha2`'s private factory builds

**Priority:** P4
**Status:** open

### Problem

`framing` was deliberately extracted and exported from `sha2` so "a fix to
the framing is made once". The *record construction* around it was left
behind in a private `const` — and `sha1` re-spells it:

```js
// sha2/module.f.mjs:277-290 (private)     // sha1/module.f.mjs:180-192 (spelled out)
const sha2 = ({ append, end, chunkLength }, hash, hashLength) => ({
    hashLength,                             export const sha1 = {
    blockLength: chunkLength,                   hashLength,
    hashBytes: divUp8(hashLength),              blockLength: chunkLength,
    blockBytes: divUp8(chunkLength),            hashBytes: divUp8(hashLength),
    init: { hash, len: 0n, remainder: empty },  blockBytes: divUp8(chunkLength),
    append,                                     init: { hash: [0x67452301n, …], len: 0n, remainder: empty },
    end: end(hashLength),                       append,
})                                              end: end(hashLength),
                                            }
```

The `hashBytes`/`blockBytes` rounding contract that `sha2/types.ts`
argues belongs in exactly one place is thus in two; a new `Hash` field or
a change to the rounding must land twice. Two smaller copies ride along:
`ch`/`maj` are byte-identical modulo parameter names (`sha2:137,140` vs
`sha1:57,63`), and the digest packer `a.reduce((p, v) => p << width | v)`
appears as `fromV8` (`sha2:245`) and `fromV5` (`sha1:158`) — the only two
instances of that fold in the tree.

### Proposal

Export three names from `fjs/crypto/sha2/module.f.mjs` beside `framing`:

```ts
import type { FramingInit, Framed, Hash } from './types.ts'
/**
 * The `Hash` over a framing and its initial words — the one place the
 * `hashBytes`/`blockBytes` rounding and the `{ hash, len: 0n, remainder: empty }`
 * initial state are spelled. `H` is the hash value's shape (`V8`, `V5`).
 */
export const framed: <H>(init: FramingInit<H>, hash: H, hashLength: bigint) => Hash<Framed<H>>
/** The bigint the words spell, most significant first, each `wordLength` bits wide; `[]` is `0n`. */
export const fromWords: (wordLength: bigint) => (words: readonly bigint[]) => bigint
export const ch: (x: bigint, y: bigint, z: bigint) => bigint
export const maj: (x: bigint, y: bigint, z: bigint) => bigint
```

`framed` takes the same `FramingInit<H>` that `framing` takes — so the
`append`/`end` it builds are `Framing<H>`'s, tied to the same `H` as
`hash`, and the state it returns is `Framed<H>` — plus the initial words
and the `hashLength` that `end` is closed over; `blockLength` is
`init.chunkLength`. Its `R` is the default `Vec`. It is the private
`sha2` factory with `framing(init)` folded in and `V8` generalized to
`H`; `sha2`'s `base` then calls `framed` per variant instead of holding a
`Base` record (the `Base` type goes with it). `fromWords` is what
`fromV8` and `fromV5` both are, with the width as a parameter, so
`sha2`'s `fromV8` becomes `fromWords(bitLength)` and `sha1`'s `fromV5`
becomes `fromWords(wordLength)`. `ch`/`maj` keep their three-argument
shape; `sha1` imports them instead of restating them over `b, c, d`.

`fromWords` is **total**: the fold is seeded with `0n`, so
`fromWords(w)([])` is `0n` — the number an empty run of words spells, and
the identity of the shift-or fold, the same way an empty `listToVec` is
`empty`. Today's `fromV8`/`fromV5` call `reduce` with no seed and would
throw on `[]`, but that case is unreachable through them (their inputs are
the fixed-length `V8`/`V5` tuples), so no live path changes; the seeded
form is chosen because a public function over `readonly bigint[]` must
answer for every value of that type, and `0n` is the answer that needs no
special case. The proof pins `fromWords(32n)([]) === 0n` alongside the
`V5`/`V8` rows. `sha1` then builds its record as
`framed({ chunkLength, lengthLength, digestLength: hashLength, compress,
digest: fromWords(wordLength) }, [0x67452301n, …], hashLength)` instead
of writing the literal, importing all four from `sha2` in place of
`framing`.

### Tasks

- [ ] Export `framed`, `fromWords`, `ch`, `maj` from
      `fjs/crypto/sha2/module.f.mjs`; re-express `sha2`'s own `base`
      through them; pin `fromWords`'s empty case at `0n`.
- [ ] Rewrite `sha1`'s record and helpers through them; proofs pass
      unchanged.
- [ ] `tsc`, `fjs test`.

### Related

- [sha1.md](./sha1.md) — asked for "the shape of `sha2`" when `sha1` was
  written; this issue shares the constructor of that shape.
- [../../sul/todo/186-sul-id-reuse-sha2-fromv8.md](../../sul/todo/186-sul-id-reuse-sha2-fromv8.md)
  — a third would-be consumer of `fromWords`.
