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
| `writeFromStream` | refused by `writeLoop`, per chunk | never reached | never reached |
| `writeExclusive` | refused in `../module.f.mjs` | never reached | never reached |
| **`writeFile`** | **not refused** | `fromVec` pads the last byte, so the file holds a byte the caller never gave, at `ok` | stores the `Vec` as it was, at `ok` |
| **`writeBytes`** | **not refused** | `fromVec` pads, so the padded byte is written at the offset, at `ok` | appends the partial `Vec` as a chunk, at `ok` |

`fromVec` is `Uint8Array.from(iterable(u8ListMsb(input)))`, and `u8ListMsb` fills
the last byte — `vec(4n)(1n)` becomes `0x10`. So the node runner writes different
contents than the caller passed and reports success, and the virtual runner keeps
something no file could hold. One effect, two answers, neither refused.

`writeBytes`'s row was wrong here until a later round of the same review, and the
mistake is worth keeping visible: `writeLoop` is a **stream helper** in
`module.f.mjs` that guards each chunk on the way to the operation, not a guard on
the operation. `writeBytes` itself is exported as a bare `do_('writeBytes')`, so a
caller that does not go through `writeFromStream` reaches the host unguarded —
measured, the virtual runner answers `ok` and appends the partial vector as a
chunk. So two exported operations are unguarded, not one, and the difference
between them and the guarded three is which *caller* is looked at rather than
which operation.

The two that do refuse it do so in `module.f.mjs` ahead of the host, and
`inflate`'s doc argues the case: a padded last byte is "a stream that was never
given". `writeFile` and `writeBytes` are the oldest, which is why they are the
ones without a guard rather than the ones that decided against it.

Found by review of
[#2115](https://github.com/functionalscript/functionalscript/pull/2115), against
`writeExclusive` — which took the guard in that PR. The other two were left
because changing what an existing operation does with an input it currently
accepts is a behaviour change of its own, and that PR had one feature in it.

### Proposal

Give `writeFile` `inflate`'s guard, in `module.f.mjs` so both runners inherit it:

```js
export const writeFile = (path, data) =>
    (length(data) & 0b111n) !== 0n
        ? pureError(ioError({ message: 'invalid buffer size' }))
        : writeFileOp(path, data)
```

and the same for `writeBytes`, which needs the operation wrapped rather than
re-exported bare.

It is a **breaking change** and wants declaring as one: a caller passing a
non-octet `Vec` gets a refusal where it used to get success, and `writeUtf8File`
and every other caller that encodes text is unaffected because UTF-8 is whole
bytes by construction. `writeFromStream` is unaffected too, since `writeLoop`
already refuses such a chunk before the operation sees it.

Worth deciding at the same time whether the guard belongs in one place rather
than four. `inflate`, `writeBytes`, `writeExclusive` and (with this) `writeFile`
each carry the same three lines; a named predicate — or a `Vec` type that cannot
hold a partial byte at all — would say it once. The second is the larger idea and
the better one, and it reaches every operation that takes a `Vec` as data rather
than as a bit string.

### Tasks

- [ ] Refuse a non-octet `Vec` in `writeFile` **and in `writeBytes`**, declared
      as a breaking change.
- [ ] Pin both, and pin that `writeUtf8File` and `writeFromStream` are
      unaffected.
- [ ] Decide whether the guards become one predicate, or whether a byte-aligned
      vector type removes the question — with five instances rather than four,
      the second is the stronger case.

### Related

- `inflate` and `writeExclusive` in [`../module.f.mjs`](../module.f.mjs) — the
  guard this copies, and the argument for it.
- `writeLoop` in the same file — the guard inside a loop rather than in front of
  an operation, which is why it covers `writeFromStream`'s callers and not
  `writeBytes`'s.
- [`../../../types/bit_vec/module.f.mjs`](../../../types/bit_vec/module.f.mjs) —
  where a byte-aligned type would live if the last task goes that way.
