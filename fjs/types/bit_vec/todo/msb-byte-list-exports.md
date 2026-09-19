## msb-byte-list-exports. `u8List(msb)` is re-bound in a dozen modules under three names

**Priority:** P4
**Status:** open

### Problem

`fjs/types/bit_vec` exports `u8List`, `u8ListToVec` and `msb`, and every
byte-oriented consumer applies the first two to the third at module scope:

```js
// fjs/git/packstore/module.f.mjs, and character-identical in fjs/git/refstore
const toBytes = u8List(msb)
const toVec = u8ListToVec(msb)
// fjs/git/repo/module.f.mjs
const u8ListMsb = u8List(msb)
const u8ListToVecMsb = u8ListToVec(msb)
// fjs/types/uint8array/module.f.mjs
const u8ListMsb = u8List(msb)
// fjs/git/oid/module.f.mjs
const toBytes = u8List(msb)
const chunkVec = u8ListToVec(msb)
```

Eight of the git modules carry one or both, and `tree`, `pack`, `packidx`
and `loose` add more; `fjs/text/utf8` and `fjs/media/type` apply
`u8List(msb)` inline instead. The byte order is a fact stated once by
`fjs/ebnf/byte`'s doc — `u8List(msb)` is the canonical spelling — and then
re-derived at every import under whatever name the module chose.
`packstore` then composes one step further four times: `v => byteArray(toBytes(v))`
in `framedAt`, `linkOf`, and twice in `framingOf`.

### Proposal

Export the two applied forms beside `msb`:

```ts
/** `u8List(msb)`: the bytes of a vector, most significant first. */
export const u8ListMsb: (v: Vec) => List<number>
/** `u8ListToVec(msb)`. */
export const u8ListToVecMsb: (list: List<number>) => Vec
```

Every module-scope binding becomes an import, so the byte order is named
in one module and read everywhere else. `packstore` gets a local
`denseBytes = v => byteArray(u8ListMsb(v))` for its four compositions.
[092](../../todo/092-nominal-msb-lsb-bit-vectors.md) would make the two
orders distinct types; that helps once the binding exists in one place
and is orthogonal to this.

### Tasks

- [ ] `u8ListMsb` and `u8ListToVecMsb` in `fjs/types/bit_vec` with proofs.
- [ ] Replace the bindings in `fjs/git/*`, `fjs/types/uint8array`,
      `fjs/text/utf8`, `fjs/media/type`.
- [ ] `tsc`, `fjs test`.

### Related

- [`../../todo/092-nominal-msb-lsb-bit-vectors.md`](../../todo/092-nominal-msb-lsb-bit-vectors.md) —
  nominal orders; complementary.
- [`../../../git/todo/ascii-digit-folds.md`](../../../git/todo/ascii-digit-folds.md) —
  the same pattern of git modules reaching past a `fjs/types` or `fjs/text`
  owner.
