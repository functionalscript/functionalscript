## object-type-lookup. One reader for the four object-type names

**Priority:** P4
**Status:** open

### Problem

"Which of the four types does this run of bytes name" is decided twice.
`fjs/git/object/module.f.mjs:79-82`:

```js
const typeOf = w => {
    const s = codePointListToString(w)
    return objectTypes.find(t => t === s) ?? null
}
```

`fjs/git/tag/module.f.mjs:77-83`:

```js
const typeOf = value => {
    const bs = byteArray(value)
    if (bs.includes(lf)) { return null }
    const nul = bs.indexOf(0)
    const text = codePointListToString(nul === -1 ? bs : bs.slice(0, nul))
    return objectTypes.find(t => t === text) ?? null
}
```

Same name, same final two operations, same reason ("the four are ASCII, so
the word is compared as the text it spells"). `tag` imports `objectTypes`
from `object` but re-implements the lookup, because `object`'s `typeOf` is
not exported — the list and its reader have been split across a module
boundary so only half the pair travels. `tag`'s delta is real but is
pre-processing (refuse an LF, cut at the first NUL — its doc comment says
why), not a different lookup.

### Proposal

Export the lookup from `fjs/git/object/module.f.mjs` as the natural
companion of the already-exported `objectTypes`, e.g.

```ts
/** The object type these bytes spell, or `null`. */
const tryType: (w: readonly number[]) => Nullable<ObjectType>
```

(the envelope reader itself uses it at `object/module.f.mjs:116`). `tag`'s
`typeOf` then keeps only its two Git-fidelity rules and delegates:

```js
const bs = byteArray(value)
if (bs.includes(lf)) { return null }
const nul = bs.indexOf(0)
return tryType(nul === -1 ? bs : bs.slice(0, nul))
```

[packfiles.md](./packfiles.md)'s decoder, which will also need to name a
type, then gets the same entry point rather than a third copy.

### Tasks

- [ ] Export the lookup from `fjs/git/object/module.f.mjs`; prove it.
- [ ] Delegate `tag`'s `typeOf` to it; tag proofs pass unchanged.
- [ ] `tsc`, `fjs test`.

### Related

- [packfiles.md](./packfiles.md) — its decoder is the next consumer.
- [positional-headers.md](./positional-headers.md) — discusses `tag`'s
  continuation-line/NUL behaviour; this issue changes none of it, only who
  owns the final lookup.
