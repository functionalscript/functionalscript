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

Export the factory from `sha2` beside `framing`, generalized over the
initial word vector: take the `{ append, end, chunkLength }` a
`framing({...})` call returns plus `init`'s hash words and `hashLength`,
and build the record once. `sha1` then calls it instead of writing the
literal. In the same pass move `ch`/`maj` and a width-parameterized word
packer to module scope in `sha2` and import them in `sha1`, which
already imports `framing` from there.

### Tasks

- [ ] Export the record factory (and `ch`/`maj`/the word packer) from
      `fjs/crypto/sha2/module.f.mjs`.
- [ ] Rewrite `sha1`'s record and helpers through them; proofs pass
      unchanged.
- [ ] `tsc`, `fjs test`.

### Related

- [sha1.md](./sha1.md) — asked for "the shape of `sha2`" when `sha1` was
  written; this issue shares the constructor of that shape.
- [../../sul/todo/186-sul-id-reuse-sha2-fromv8.md](../../sul/todo/186-sul-id-reuse-sha2-fromv8.md)
  — a third would-be consumer of the exported word packer.
