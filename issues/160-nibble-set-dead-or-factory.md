# 160. `nibble_set` duplicates `byte_set`: delete it, or extract a `bitSet` factory

`fs/types/byte_set/module.f.ts` and `fs/types/nibble_set/module.f.ts` implement
the same bitmask-as-set algebra. They differ only in the numeric domain
(`bigint` + `1n` for byte_set, `number` + `1` for nibble_set) and the
`universe` constant:

```ts
// byte_set                                  // nibble_set
export const has = n => s =>                 export const has = n => s =>
    ((s >> BigInt(n)) & 1n) === 1n               ((s >> n) & 1) === 1
export const one = n => 1n << BigInt(n)      const  one = n => 1 << n
export const range = ([b, e]) =>             const  range = ([a, b]) =>
    one(e - b + 1) - 1n << BigInt(b)             one(b - a + 1) - 1 << a
export const complement = n => universe ^ n  export const complement = s => universe ^ s
export const set = compose(one)(union)       export const set = n => s => s | one(n)
export const setRange = ...                  export const setRange = ...
export const unset = n => s =>               export const unset = n => s =>
    difference(s)(one(n))                        s & complement(one(n))
```

`has`, `one`, `range`, `complement`, `set`, `setRange`, and `unset` are the
same logic line-for-line.

## The catch: `nibble_set` is unused

`grep -rn nibble_set fs/` finds no consumer anywhere outside its own directory
and test. `byte_set`, by contrast, is used by `fs/fsm`
(`fsm/module.f.ts:7`, `fsm/test.f.ts:2`).

`AGENTS.md` is explicit on both points:

> Don't implement a feature, helper, or module that no existing module uses…
> Speculative code rots…
>
> [DRY] — only extract once the second real consumer exists.

So the duplication does **not** yet justify a shared factory — the second
consumer required to trigger DRY does not exist. The primary recommendation is
therefore the opposite of "abstract it":

**Recommendation A (default): delete `fs/types/nibble_set/`.** It is a
speculative duplicate of `byte_set` with no consumer. Remove the module, its
test, and its `deno.json` `exports` entry.

**Recommendation B (only if a nibble consumer is actually planned):** extract a
shared `bitSet` factory and instantiate it twice. The factory is parameterized
over the numeric unit and the universe:

```ts
type BitOps<T> = {
    readonly zero: T
    readonly one: T            // the value 1 in domain T
    readonly shl: (a: T) => (n: number) => T
    readonly shr: (a: T) => (n: number) => T
    readonly or:  (a: T) => (b: T) => T
    readonly and: (a: T) => (b: T) => T
    readonly xor: (a: T) => (b: T) => T
    readonly universe: T
}
const bitSet = <T>(b: BitOps<T>) => ({ has, one, range, set, setRange, unset, complement, union, /* … */ })
// byteSet   = bitSet(bigintOps(0xFFFF…FFFFn))
// nibbleSet = bitSet(numberOps(0xFFFF))
```

Note `byte_set` also carries domain-specific extras (`toRangeMap`, the
`counter`/`toRangeMapOp` machinery, lines 55–65) that `nibble_set` lacks; those
stay outside the factory.

Pick A unless someone can name the nibble consumer. This issue is mostly a
flag that `nibble_set` is dead weight, with the factory written down so the
choice is explicit rather than implicit.

## Related

- [i65](./065-mutability.md) — mutability inference; both modules are pure and
  would make clean factory inputs.
