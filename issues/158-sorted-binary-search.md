# 158. Sorted collections: shared binary search and `Cmp<T>` alias

Two small, precedent-clean DRY fixes in the sorted-collection cluster.

## 1. Duplicated binary-search loop

`fs/types/sorted_list/module.f.ts:57` (`find`) and
`fs/types/range_map/module.f.ts:98` (`get`) implement the same midpoint
binary-search skeleton, differing only in the probe predicate and the
not-found result.

```ts
// sorted_list/module.f.ts:57
export const find = <T>(cmp) => value => array => {
    let b = 0
    let e = array.length - 1
    while (true) {
        const d = e - b
        if (d < 0) return null
        const mid = b + (d >> 1)
        switch (cmpValue(array[mid])) {
            case -1: { e = mid - 1; break }
            case 0:  { return value }
            case 1:  { b = mid + 1; break }
        }
    }
}

// range_map/module.f.ts:98
export const get = <T>(def) => value => rm => {
    const len = rm.length
    let b = 0
    let e = len - 1
    while (true) {
        if (b >= len) { return def }
        if (e - b < 0) { return rm[b][0] }
        const mid = b + (e - b >> 1)
        if (value <= rm[mid][1]) { e = mid - 1 } else { b = mid + 1 }
    }
}
```

Both use the same `b` / `e` / `mid = b + (delta >> 1)` convergence. The two
"not found" semantics differ — `find` returns `null` on a miss, while `get`
returns the predecessor entry / `def` — so the shared helper should return the
converged position and let each caller interpret it:

```ts
// in sorted_list (or array): returns the final lower bound `b`
export const bsearch =
    (len: number) => (probe: (mid: number) => Sign): number => {
        let b = 0
        let e = len - 1
        while (true) {
            if (e < b) { return b }
            const mid = b + (e - b >> 1)
            switch (probe(mid)) {
                case -1: { e = mid - 1; break }
                case 0:  { return mid }
                case 1:  { b = mid + 1; break }
            }
        }
    }
```

`find` supplies `cmp(value)(array[mid])` and maps a hit to `value` / a miss to
`null`; `get` supplies `value <= rm[mid][1] ? -1 : 1` and reads `rm[b]` / `def`
from the returned `b`. Both modules are in production (`find` backs
`sorted_set`; `get` is called by `js/tokenizer`), so the second-consumer rule is
satisfied. `range_map` already imports from `sorted_list`, so that is the
natural home for the helper.

Both loops also use `let`/reassignment — the imperative search is the one place
the codebase tolerates it; a single audited helper confines that to one
function instead of two.

## 2. Duplicated `Cmp<T>` type alias

`fs/types/sorted_list/module.f.ts:15` and `fs/types/sorted_set/module.f.ts:35`
both declare the identical curried comparator:

```ts
type Cmp<T> = (a: T) => (b: T) => Sign
```

`fs/types/function/compare/module.f.ts` already owns the comparison vocabulary
but only exports the *partially-applied* unary form
(`Compare<T> = (_: T) => Sign`, line 10). Per the `AGENTS.md` rule "when a
sibling module already has the type you need, import it," add and export the
curried `Cmp<T>` there and import it in both call sites rather than
re-declaring it.

## Related

- [i134](./README.md) — nominal-type narrowing, also touches the comparator
  vocabulary in `function/compare`.
