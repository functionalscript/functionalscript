## `FramingInit` is the API; `Base` restates it

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) builds `init32` and `init64`, each a
`FramingInit<V8>`, and then exports neither. It exports `base32` and
`base64` instead, built by `base`:

```js
const base = init => {
    const { chunkLength, compress, digest } = init
    const { update, end } = framing(init)
    // A block is sixteen words.
    return { bitLength: chunkLength >> 4n, chunkLength, compress, fromV8: digest, update, end }
}
```

`Base` in [`types.ts`](../types.ts) is `FramingInit` under renamed fields,
`fromV8` for `digest` and `bitLength` for a quantity derived from
`chunkLength`, plus an `update` and `end` nothing outside the proof reads.
The one consumer at `d7bead6`, `hashMerge` in
[`fjs/sul/id`](../../../sul/id/module.f.mjs), uses `compress` and `fromV8`,
both fields of the init. The module's own [`proof.f.mjs`](../proof.f.mjs)
then rebuilds the `FramingInit` out of `base32` to feed `framed`:

```js
const { bitLength, chunkLength, compress, fromV8 } = base32
const init = { chunkLength, lengthLength: bitLength << 1n, digestLength: bitLength << 3n, compress, digest: fromV8 }
```

Two records describe one thing, and the API offers the derived one while
hiding the primary one.

### Proposal

Export `init32` and `init64`; delete `base`, `base32`, `base64` and `Base`.
`sul/id` reads `init32.compress` and `init32.digest`; the proof passes
`init32` to `framed` as it is. Breaking, with both importers in the tree.

### Tasks

- [ ] Export the inits; delete the derived record and its type.
- [ ] `sul/id` and the proof over the inits.
- [ ] `tsc` and the suites under `fjs/crypto/sha2` and `fjs/sul`.

### Related

- [block-words](./block-words.md) — the other sha1/sha2 seam.
