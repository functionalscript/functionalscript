## Derive `front`/`removeFront` from `unpackSplit`

**Priority:** P3
**Status:** open

### Problem

`bo` already derives `unpackPopFront` generically from the injected
`unpackSplit` (`module.f.mjs:258-267`), yet `_Base` also demands hand-written
`front` and `removeFront` from each bit order (`module.f.mjs:186-187`), and
both `lsb` (`:330-337`) and `msb` (`:356-366`) re-derive exactly those two
projections by hand. Substituting each order's `unpackSplit` into
`unpackPopFront` reproduces both bodies: `front(len)(v)` is
`unpackPopFront(len)(unpack(v))[0]` and `removeFront(len)(v)` is
`pack(unpackPopFront(len)(unpack(v))[1])` (`vec` re-masks, so the unmasked
rest is fine).

`startsWith` (`:311-314`) shows the cost from the other side — it needed "the
first `n` bits" and reached for `popFront(n)(v)[0]` instead of `front`, so the
same extraction now exists four ways in one module.

The same section has three call-invariant partial applications rebuilt per
call (AGENTS.md §6.3):

- `:313` — `popFront(n)(v)[0]` rebuilds `popFront(n)` per `v`, though `n`
  comes from `prefix`, bound one scope up.
- `:277-278` — `map(unpack)` is independent of `list` and doesn't even depend
  on `bo`, so it belongs at module scope. (`unpackListToVec(unpackConcat)` is
  already bound once per bit order, here and in `tryU8ListToVec`.)
- `:381-383` — the `b => ({ length: 8n, uint: BigInt(b) })` helper closes over
  nothing and is re-created per list.

### Proposal

Drop `front`/`removeFront` from `_Base` (and from the `lsb`/`msb` literals)
and define them once inside `bo` next to `popFront`, derived from
`unpackPopFront`. Make `startsWith` use the derived `front`. The `_Base`
injection surface shrinks to the genuinely order-specific parts (`norm`,
`uintCmp`, `unpackSplit`, `unpackConcatUint`). Hoist the three call-invariant
partial applications to their dependency's scope.

### Tasks

- [ ] Remove `front`/`removeFront` from `_Base` and derive them in `bo`
- [ ] Rewrite `startsWith` through the derived `front`, binding it once per
      `prefix`
- [ ] Hoist `map(unpack)` and the u8 `Unpacked` constructor to module scope

### Related

- [92](../../todo/92.md) — nominal MSB/LSB types touch the same surface
- [195](../../todo/195.md) — `listToVec` concatenation order, same module
