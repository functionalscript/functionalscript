## `writeFile` pads a `Vec` that is not whole bytes instead of refusing it

**Priority:** P3
**Status:** open

### Problem

A file holds bytes and a `Vec` holds bits, so a `Vec` whose length is not a
multiple of eight is not file contents. The runners disagree about what to do
with one, and the disagreement is silent:

| operation | a `Vec` of 4 bits | the node runner | the virtual runner |
| --- | --- | --- | --- |
| `inflate` | refused in [`../module.f.mjs`](../module.f.mjs) | never reached | never reached |
| `writeBytes` | refused by `writeLoop` | never reached | never reached |
| `writeExclusive` | refused in `../module.f.mjs` | never reached | never reached |
| **`writeFile`** | **not refused** | `fromVec` pads the last byte, so the file holds a byte the caller never gave, at `ok` | stores the `Vec` as it was, at `ok` |

`fromVec` is `Uint8Array.from(iterable(u8ListMsb(input)))`, and `u8ListMsb` fills
the last byte — `vec(4n)(1n)` becomes `0x10`. So the node runner writes different
contents than the caller passed and reports success, and the virtual runner keeps
something no file could hold. One effect, two answers, neither refused.

Three of the four operations already refuse it, each in `module.f.mjs` ahead of
the host, and `inflate`'s doc argues the case: a padded last byte is "a stream
that was never given". `writeFile` is the one left, and it is the oldest of them,
which is why it is the one without the guard rather than the one that decided
against it.

Found by review of
[#2115](https://github.com/functionalscript/functionalscript/pull/2115), against
`writeExclusive` — which took the guard in that PR. `writeFile` was left because
changing what an existing operation does with an input it currently accepts is a
behaviour change of its own, and that PR had one feature in it.

### Proposal

Give `writeFile` `inflate`'s guard, in `module.f.mjs` so both runners inherit it:

```js
export const writeFile = (path, data) =>
    (length(data) & 0b111n) !== 0n
        ? pureError(ioError({ message: 'invalid buffer size' }))
        : writeFileOp(path, data)
```

It is a **breaking change** and wants declaring as one: a caller passing a
non-octet `Vec` gets a refusal where it used to get success, and `writeUtf8File`
and every other caller that encodes text is unaffected because UTF-8 is whole
bytes by construction.

Worth deciding at the same time whether the guard belongs in one place rather
than four. `inflate`, `writeBytes`, `writeExclusive` and (with this) `writeFile`
each carry the same three lines; a named predicate — or a `Vec` type that cannot
hold a partial byte at all — would say it once. The second is the larger idea and
the better one, and it reaches every operation that takes a `Vec` as data rather
than as a bit string.

### Tasks

- [ ] Refuse a non-octet `Vec` in `writeFile`, declared as a breaking change.
- [ ] Pin it, and pin that `writeUtf8File` is unaffected.
- [ ] Decide whether the four guards become one predicate, or whether a
      byte-aligned vector type removes the question.

### Related

- `inflate` and `writeExclusive` in [`../module.f.mjs`](../module.f.mjs) — the
  guard this copies, and the argument for it.
- `writeLoop` in the same file — the third instance, inside a loop rather than in
  front of an operation.
- [`../../../types/bit_vec/module.f.mjs`](../../../types/bit_vec/module.f.mjs) —
  where a byte-aligned type would live if the last task goes that way.
