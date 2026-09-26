## binary-word-reader. `pack` and `packidx` each define the big-endian word and the magic test

**Priority:** P4
**Status:** open

### Problem

The two binary readers in `fjs/git` each carry the same private
decoder, character for character:

```js
// fjs/git/pack/module.f.mjs, and again in fjs/git/packidx/module.f.mjs
const u32 = (b, at) => b[at] * 16777216 + b[at + 1] * 65536 + b[at + 2] * 256 + b[at + 3]
```

Only the `packidx` copy explains why it multiplies rather than shifts —
`<<` would sign the top bit — and only it builds `u64` on top. Both
readers also test their magic bytes the same way, and `refstore/write`'s
`isNamePrefix` opens with the same test before its own two checks:

```js
// pack, tryHeader
if (!signature.every((v, i) => b[i] === v)) { return null }
// packidx, tryIdx
return magic.every((v, i) => b[i] === v) ? tryV2(b, oidBytes) : tryV1(b, oidBytes)
// refstore/write
b.length > a.length && b[a.length] === slash && a.every((v, i) => b[i] === v)
```

The subtle part of the word reader is the unsigned trap, and one copy
has it in a comment while the other has to be read to be trusted. The
next binary format — a reverse index, a multi-pack index, a commit graph
— copies whichever it finds first.

### Proposal

One small module the readers share, `fjs/git/bytes/module.f.mjs` or a
general home under `fjs/types`:

```ts
/** The unsigned big-endian word at `at`; multiplies, since `<<` would sign the top bit. */
export const u32be: (b: Bytes, at: number) => number
/** The big-endian double word, or `null` above the safe integer range. */
export const u64be: (b: Bytes, at: number) => Nullable<number>
export const startsWith: (prefix: Bytes) => (b: Bytes) => boolean
```

`u64be` moves from `packidx`; `pack` and `packidx` import the three.
`isNamePrefix` is not a plain prefix test and stays what it is: a name
prefix requires the other name to be longer and its next byte to be the
separator, or `refs/heads/foo` would collide with itself and with
`refs/heads/foobar`. Only its `every` becomes `startsWith(a)(b)`; the
two boundary checks stay in front of it.

### Tasks

- [ ] The module with proofs, including the top-bit case for `u32be`.
- [ ] The three importers; no private `u32` left.
- [ ] `tsc`, `fjs test`.

### Related

- [ascii-byte-constants.md](./ascii-byte-constants.md) — the same
  readers' bare byte literals; a second thing they would share.
