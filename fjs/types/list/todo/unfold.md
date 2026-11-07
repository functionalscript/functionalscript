## A lazy `unfold`

**Priority:** P4
**Status:** open

### Problem

The thunk that produces a lazy list from a seed, `() => done ? null : {
first, tail: next(state) }`, is written wherever a module builds one:
`countdown` and `fromArrayLike` in [`module.f.js`](../module.f.js),
`stringToList` in [`fjs/text/utf16`](../../../text/utf16/module.f.js),
`chunks` inside `u8ListToVecChunksMsb` in
[`fjs/types/bit_vec`](../../bit_vec/module.f.mjs), and `decodeList` in
[`fjs/asn.1`](../../../asn.1/module.f.mjs), which its doc describes as
"lazily drains a bit vector by repeatedly applying a step", which is an
unfold. This module has every fold and no unfold.

### Proposal

```ts
unfold: <S, T>(step: (seed: S) => readonly [T, S] | null) => (seed: S) => List<T>
```

beside `repeat` and `countdown`; `decodeList` becomes `unfold(v =>
length(v) === 0n ? null : step(v))`, and the others one line each.

### Tasks

- [ ] `unfold` with a proof.
- [ ] The five producers over it, as they are touched.

### Related

- [simplify-list-type](./simplify-list-type.md) — the `List` type the
  unfold produces.
