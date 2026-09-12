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
/** The `Hash` record over a framing and its initial words: the one place the rounding contract lives. */
export const framed: <H>(f: { append, end, chunkLength }, hash: H, hashLength: bigint) => Hash<…>
/** The bigint the words spell, most significant first, each `wordLength` bits wide. */
export const fromWords: (wordLength: bigint) => (words: readonly bigint[]) => bigint
```

plus `ch` and `maj` under the names they already have. `framed` is the
private `sha2` factory generalized over the word vector; `fromWords` is
what `fromV8` and `fromV5` both are, with the width as a parameter, so
`sha2`'s `fromV8` becomes `fromWords(bitLength)` and `sha1`'s `fromV5`
becomes `fromWords(wordLength)`. `sha1` then builds its record by calling
`framed` instead of writing the literal, importing all four from `sha2`
as it already imports `framing`.

### Tasks

- [ ] Export `framed`, `fromWords`, `ch`, `maj` from
      `fjs/crypto/sha2/module.f.mjs`; re-express `sha2`'s own `base`
      through them.
- [ ] Rewrite `sha1`'s record and helpers through them; proofs pass
      unchanged.
- [ ] `tsc`, `fjs test`.

### Related

- [sha1.md](./sha1.md) — asked for "the shape of `sha2`" when `sha1` was
  written; this issue shares the constructor of that shape.
- [../../sul/todo/186-sul-id-reuse-sha2-fromv8.md](../../sul/todo/186-sul-id-reuse-sha2-fromv8.md)
  — a third would-be consumer of `fromWords`.
