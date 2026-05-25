# 167. `bit_vec`: export the bound `msb`/`lsb` vector concatenation

`fs/types/bit_vec/module.f.ts:471` exports a `listToVec` combinator that folds a
`List<Vec>` into one `Vec` using a given `BitOrder`'s `concat`:

```ts
// bit_vec/module.f.ts:471
export const listToVec = ({ concat }: BitOrder): (list: List<Vec>) => Vec =>
    fold(flip(concat))(empty)
```

Every consumer that needs to concatenate MSB-ordered vectors re-binds the
*same* partial application `listToVec(msb)` under a different local name:

| Module | Line | Binding |
|---|---|---|
| `fs/crypto/sign/module.f.ts` | 58 | `const ltov = listToVec(msb)` |
| `fs/asn.1/module.f.ts` | 28 | `const concat = listToVec(msb)` |
| `fs/sul/id/module.f.ts` | 129 | `const ltv = listToVec(msb)` |
| `fs/sul/level/literal/module.f.ts` | 112 | `const concat = listToVec(msb)` |
| `fs/asn.1/test.f.ts` | 19 | `const cat = listToVec(msb)` |

These are byte-for-byte the same expression; only the local alias differs. The
MSB order is the overwhelmingly common case (no module re-binds `listToVec(lsb)`
today — `repeat` at `bit_vec/module.f.ts:477` uses `lsb.concat` directly).

## Proposed abstraction

Bind the order once, in `bit_vec`, and export it so consumers import instead of
re-deriving:

```ts
// bit_vec/module.f.ts
export const msbConcat: (list: List<Vec>) => Vec = listToVec(msb)
export const lsbConcat: (list: List<Vec>) => Vec = listToVec(lsb)
```

Then each call site drops its local binding and imports `msbConcat`. The four
production modules above become one-line import changes. `crypto/sign` keeps its
variadic adapter (a single consumer) but points it at the shared function:

```ts
// crypto/sign/module.f.ts:60
export const concat = (...x: readonly Vec[]): Vec => msbConcat(x)
```

## Why this qualifies

- Four real production consumers already exist (plus a test), well past the
  "second real consumer" bar in `AGENTS.md`.
- The helper belongs in `bit_vec` by separation of concerns: it is a `Vec`
  operation, and `bit_vec` already owns `listToVec`, `repeat`, `msb`, and `lsb`.
- It removes the per-module aliasing (`ltov`/`ltv`/`concat`/`cat`) that obscures
  that all four sites do the identical thing.

## Notes

- Only export `lsbConcat` if a consumer materializes; `msbConcat` alone covers
  every current call site. Per the "don't ship unused helpers" rule, the
  conservative landing exports just `msbConcat`.
- `sul/id/module.f.ts:134` separately destructures `const { concat } = msb` for
  pairwise (non-list) concatenation — that is a different operation and is not
  part of this duplication.

## Related

- This is a small, mechanical sibling to [i161](./161-keyed-btree-collection.md)
  and [i160](./160-nibble-set-dead-or-factory.md): export the already-factored
  primitive rather than re-binding it per consumer.
