## 66v-list-tryfold. Move the early-exit fold driver from `bit_vec` to `list`

**Priority:** P4
**Status:** open

### Problem

`fs/types/bit_vec/module.f.ts` defines a fully generic accumulator type and
a traversal driver that folds a `List` while bailing out on the first
`null`, then finalizes:

```ts
type Accumulator<I, T, R> = {
    init: T
    update: (i: I, state: T) => Nullable<T>
    end: (state: T) => R
}
```

```ts
const unpackListToVec = (unpackConcat: UnpackConcat) => {
    const { init, update, end } = listToVecOp(unpackConcat)
    return (list: List<Unpacked>): Nullable<Vec> => {
        let result: ListToVecState = init
        for (const e of iterable(list)) {
            const candidate = update(e, result)
            if (candidate === null) { return null }
            result = candidate
        }
        return end(result)
    }
}
```

(`fs/types/bit_vec/module.f.ts:311-315` and `:363-374`.) All bit-vector
knowledge lives in `listToVecOp` (the binary-counter `init`/`update`/`end`);
the driver is a domain-agnostic *try-fold* over `List<I>` with `Nullable`
short-circuit. That is `fs/types/list` territory — the module that already
hosts `fold`, `foldScan`, `stateScan` — and it matches the codebase's
documented `try*`-returning-`Nullable` convention (`AGENTS.md`). This is a
separation-of-concerns move, appropriate even with the single consumer.

### Proposal

Move the type and driver into `fs/types/list/module.f.ts`:

```ts
export type Accumulator<I, T, R> = {
    readonly init: T
    readonly update: (i: I, state: T) => Nullable<T>
    readonly end: (state: T) => R
}

export const tryFold = <I, T, R>({ init, update, end }: Accumulator<I, T, R>) =>
    (input: List<I>): Nullable<R> => { /* the loop above */ }
```

`bit_vec` then supplies only the domain accumulator:
`unpackListToVec = unpackConcat => tryFold(listToVecOp(unpackConcat))`.

Scope note: this is distinct from
[195](../../todo/195.md)-style concerns about the balanced concatenation
order — that logic stays untouched inside `listToVecOp`. Only the traversal
driver moves.

### Tasks

- [ ] Add `Accumulator` and `tryFold` to `fs/types/list/module.f.ts` with
      proof coverage (success, early-`null`, empty-list paths).
- [ ] Rewrite `unpackListToVec` in `bit_vec` on top of it; remove the local
      `Accumulator` type.
- [ ] Run `npx tsc` and `fjs t`; confirm `bit_vec` proofs still pass,
      including the `maxLength` overflow path.

### Related

- `fs/types/list/module.f.ts` — `fold`, `foldScan`, `stateScan`, the
  existing fold family `tryFold` joins.
- `AGENTS.md` — the `try*`/`Nullable` convention for fallible operations.
