## or-handler-shared. Share the `or` visitor handler between `validate` and `parse`

**Priority:** P4
**Status:** open

### Problem

`validate` and `parse` are built as `Visitor<R>` records over the `Type` ADT,
and `rtti/common` already owns every shared handler except the containers
(filed separately). The `or` handler is the one remaining duplicated visitor
handler no todo covers, and the two copies implement the identical "try each
variant against the value, return the first `'ok'`, else `verror('no match')`"
algorithm in two gratuitously different styles:

```ts
// fs/types/rtti/validate/module.f.ts:135-147 — eager map + imperative early-exit loop
const orValidate = <T extends readonly Type[]>(rtti: T): Validate<() => readonly['or', ...T]> => {
    const all = rtti.map(r => validate(r))
    return value => {
        for (const i of all) {
            const r = (i as any)(value)
            if (r[0] === 'ok') { return r }
        }
        return verror('no match')
    }
}

// fs/types/rtti/parse/module.f.ts:159-165 — lazy listMap + list.find
const findFirst = find(verror('no match'))((k: any) => k[0] === 'ok')

const orParse = <T extends readonly Type[]>(rtti: T): Parse<() => readonly['or', ...T]> =>
    value => findFirst(listMap(t => (parse as any)(t)(value))(rtti))
```

Unlike the container handlers, `or` has **no** success-construction
difference between the two modules — both return the matching branch's result
verbatim. The only real difference is which recursive function (`validate` vs
`parse`) is threaded in; the for-loop vs `find` divergence is noise, and
`parse` carries the `findFirst`/`listMap` plumbing only to express it. Each
copy also needs its own `as any` (the recursive `Ts<Type>` evaluation hits
TS2589).

### Proposal

Hoist a single `or` handler into `fs/types/rtti/common/module.f.ts`,
parameterized by the recursive walker, next to `visit`/`verror`:

```ts
/** First variant that accepts `value`, else `verror('no match')`. */
export const orVisit =
    (recurse: (t: Type) => (value: Unknown) => Result) =>
    (variants: readonly Type[]) => (value: Unknown): Result => {
        for (const t of variants) {
            const r = recurse(t)(value)
            if (r[0] === 'ok') { return r }
        }
        return verror('no match')
    }
```

`validate` uses `orVisit(validate)`, `parse` uses `orVisit(parse)`; `parse`
drops `findFirst` and its `listMap` import. The TS2589-driven cast then lives
in one place instead of two.

### Tasks

- [ ] Add `orVisit` to `fs/types/rtti/common/module.f.ts`; rewrite
      `orValidate`/`orParse` through it; delete `findFirst`.
- [ ] `npx tsc`, `fjs t`; rtti proofs pass unchanged.

### Related

- [parse-validate-shared-entry-loop.md](./parse-validate-shared-entry-loop.md)
  — the *container* handlers' shared entry loop; explicitly leaves
  `orValidate`/`orParse` untouched. Complementary.
- [../../todo/172.md](../../todo/172.md) — container validate/parse
  factories; same boundary, does not mention `or`.
