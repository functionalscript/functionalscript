## variadic-concat-to-bit-vec. Move the variadic `concat` from `crypto/sign` to `bit_vec`

**Priority:** P4
**Status:** open

### Problem

`fs/crypto/sign/module.f.ts:53-55` defines and **exports** an n-ary
bit-vector concatenation:

```ts
const { listToVec } = msb

export const concat = (...x: readonly Vec[]): Vec => listToVec(x)
```

Nothing about it is signing-specific — it is the variadic sibling of the
binary `msb.concat`, pure `bit_vec` logic living in (and widening the
public API of) the ECDSA module. It has no external consumer besides the
module's own `proof.f.ts`, which awkwardly imports this `concat` *and*
separately reaches for the binary `msb.concat` (`proof.f.ts:7,72`).
`AGENTS.md`: path-style logic belongs in its natural module even with a
single consumer, and a declaration should only be `export`ed for a real
external consumer.

### Proposal

Move the variadic form into `fs/types/bit_vec/module.f.ts` as part of the
bit-order namespace (both `msb` and `lsb` get it for symmetry, since it is
one line over the existing `listToVec`):

```ts
// in BitOrder
readonly concatAll: (...v: readonly Vec[]) => Vec
// implementation
concatAll: (...v) => listToVec(v)
```

`crypto/sign` (and its proof) then import `msb.concatAll` and the local
`export const concat` is deleted — the signing module's public API shrinks
to signing concerns. If extending the `BitOrder` type is judged too wide
for the gain, the minimal variant is a module-level `const concat = (...x:
readonly Vec[]): Vec => listToVec(x)` kept **private** in `crypto/sign`
(un-exporting it) — but the `bit_vec` home is preferred.

### Tasks

- [ ] Add `concatAll` to `BitOrder` in `fs/types/bit_vec/module.f.ts` with
      proof coverage (0, 1, n arguments; both bit orders).
- [ ] Replace `concat` uses in `fs/crypto/sign/module.f.ts` and
      `proof.f.ts`; delete the local export.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- `fs/types/bit_vec/module.f.ts` — `listToVec`, `concat` (binary), the
  natural home.
- `AGENTS.md` — separation-of-concerns and export-only-with-consumer rules.
