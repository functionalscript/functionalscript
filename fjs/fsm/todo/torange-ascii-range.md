## `toRange` re-implements `ascii.range` and crashes on one character

**Priority:** P3
**Status:** open

### Problem

```js
export const toRange = s => {
    const [b, e] = toArray(stringToList(s))
    return range([b, e])
}
```

`fjs/text/ascii/module.f.mjs:20-25` already owns "two-character string →
inclusive `Range`", including the one-character case. `fsm.toRange`
(`module.f.mjs:32-36`) is `compose(asciiRange)(byteSetRange)` written out by
hand — and the duplicate is worse than the original:

```
toRange('a')  → RangeError: The number NaN cannot be converted to a BigInt
```

because `e` destructures to `undefined` and `byte_set.range` computes
`one(undefined - b + 1)`. `fjs/fsc/module.f.mjs:66` shows the correct
composition (`fn(asciiRange).map(codePointRange)`).

`toUnion` (`:39-45`) — "byte set from the characters of a string" — is
likewise generic byte-set vocabulary, the same shape as `fjs/bnf`'s `set(s)`
for its own alphabet. Both exports have no consumer outside
`fjs/fsm/proof.f.mjs`.

### Proposal

`export const toRange = compose(asciiRange)(byteSetRange)` (or drop the
export if the proof stays the only caller); move `toUnion` to
`fjs/types/byte_set` next to `one`/`set`.

### Tasks

- [ ] Rebuild `toRange` on `ascii.range`; cover the one-character case
- [ ] Move `toUnion` to `byte_set` (or inline it into the proof)
