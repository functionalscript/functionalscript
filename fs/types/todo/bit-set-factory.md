## bit-set-factory. `byte_set` and `nibble_set` are one bitmask-set algebra

**Priority:** P3
**Status:** open

### Problem

`fs/types/nibble_set/module.f.ts` and `fs/types/byte_set/module.f.ts`
implement the same bitmask-as-set algebra, line for line, differing only in
the numeric domain (`number` with `universe = 0xFFFF` vs `bigint` with the
256-bit universe) and the `BigInt(n)` shift-operand conversion. The
`nibble_set` module header even documents it: *"It implements the same
bitmask-as-set algebra as `byte_set`"*.

| operation | `byte_set` (bigint) | `nibble_set` (number) |
|-----------|---------------------|-----------------------|
| `has` | `n => s => ((s >> BigInt(n)) & 1n) === 1n` (`:15`) | `n => s => ((s >> n) & 1) === 1` (`:31`) |
| `one` | `n => 1n << BigInt(n)` (`:24`) | `n => 1 << n` (`:28`) |
| `range` | `([b, e]) => one(e - b + 1) - 1n << BigInt(b)` (`:27`) | `([a, b]) => one(b - a + 1) - 1 << a` (`:43`) |
| `complement` | `n => universe ^ n` (`:38`) | `s => universe ^ s` (`:37`) |
| `set` / `setRange` / `unset` | `:45-52` | `:34-46` |

`nibble_set` is also an *incomplete* copy: it lacks the binary set ops
(`union`/`intersect`/`difference`) that `byte_set` has (`:32-42`).

This is exactly the AGENTS.md DRY case: same algorithm, two real consumers,
differing only in constants — the situation `fs/base_n` already solves for
base-N codecs with a parameterized factory.

### Proposal

Introduce a factory, e.g. `fs/types/bit_set/module.f.ts`:

```ts
export type BitSetOps<T> = {
    readonly empty: T
    readonly universe: T
    readonly one: (n: number) => T
    readonly or: (a: T) => (b: T) => T
    readonly and: (a: T) => (b: T) => T
    readonly xor: (a: T) => (b: T) => T
    readonly dec: (a: T) => T          // for `range`: one(len) - 1
    readonly shl: (a: T) => (n: number) => T
}
export const bitSet = <T>(ops: BitSetOps<T>) => ({ has, one, range, set, setRange, unset, union, intersect, complement, difference })
```

(or a smaller parameter set — e.g. just `{ zero, universeBits, fromNumber }`
— whatever proves minimal in practice). `byte_set` becomes
`bitSet(bigintOps)` with its 256-bit universe; `nibble_set` becomes
`bitSet(numberOps)` with `0xFFFF` and picks up `union`/`intersect`/
`difference` for free (export them only when a consumer appears, per
AGENTS.md). `byte_set`'s `toRangeMap` stays local — it is genuinely
byte-specific.

Rider: both modules inline `readonly [number, number]` for `range`'s
parameter; the factory should use `Range` from `fs/types/range/module.f.ts`.

`has` on a `bigint` set may deserve a domain-specific override if the
generic form costs (see [185](./185.md) for the mask-based direction) —
the factory can accept per-domain overrides or `byte_set` can shadow the
generic `has`.

### Tasks

- [ ] Add `fs/types/bit_set/module.f.ts` (+ `proof.f.ts`, register in
      `deno.json` exports) with the parameterized algebra.
- [ ] Rewrite `byte_set` and `nibble_set` as instantiations, preserving
      their public APIs and JSDoc (including nibble_set's
      "prefer byte_set / JSON-serializable" guidance).
- [ ] `npx tsc`, `fjs t`; both proofs pass unchanged.

### Related

- [185](./185.md) — `byte_set`-internal `range`/`one` via `bigint.mask`;
  orthogonal — the shared `range` can use `mask` internally once extracted.
- `fs/base_n/module.f.ts` — the codebase's precedent for
  constants-parameterized codec factories.
