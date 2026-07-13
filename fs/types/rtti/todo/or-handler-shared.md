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
parameterized by the recursive walker, next to `visit`/`verror`. The
signature cannot mention `Result<T>` at bare `Type` — `Result<T extends
Type>` expands to `CommonResult<Ts<T>, ValidationError>`, and instantiating
`Ts<Type>` is exactly the TS2589 blow-up the existing casts dodge — so the
handler is typed over *erased* aliases that never invoke `Ts`:

```ts
/** `Result` with the payload type erased; avoids instantiating `Ts<Type>`. */
export type ResultE = CommonResult<Unknown, ValidationError>
export type ValidateE = (value: Unknown) => ResultE

/** First variant that accepts `value`, else `verror('no match')`. */
export const orVisit =
    (recurse: (t: Type) => ValidateE) =>
    (variants: readonly Type[]) => (value: Unknown): ResultE => {
        for (const t of variants) {
            const r = recurse(t)(value)
            if (r[0] === 'ok') { return r }
        }
        return verror('no match')
    }
```

The aliases are `export`ed because the boundary casts live in the sibling
`validate`/`parse` modules — real external consumers from day one, per the
AGENTS.md export rule. Each consumer passes its recursive function with one
deliberately localized cast at the boundary (typing `validate`/`parse` *as* `(t: Type) =>
ValidateE` would itself instantiate `Validate<Type>` and hit TS2589, so the
erasure must be a cast, not an annotation):

```ts
const orValidate = <T extends readonly Type[]>(rtti: T): Validate<() => readonly['or', ...T]> =>
    orVisit(validate as (t: Type) => ValidateE)(rtti) as Validate<() => readonly['or', ...T]>
```

and likewise for `parse`; `parse` drops `findFirst` and its `listMap` import.
Net: the loop body exists once with no cast inside it, and each consumer
carries exactly one documented boundary cast — down from a cast inside the
loop (`validate`) plus two `any`s (`parse`).

### Tasks

- [ ] Add `ResultE`/`ValidateE` and `orVisit` to
      `fs/types/rtti/common/module.f.ts`; rewrite `orValidate`/`orParse`
      through it with one boundary cast each; delete `findFirst`.
- [ ] `npx tsc`, `fjs t`; rtti proofs pass unchanged.

### Related

- `fs/types/rtti/common/module.f.ts`'s `eachEntry` — the *container* handlers'
  shared entry loop (already hoisted); explicitly leaves `orValidate`/`orParse`
  untouched. Complementary.
- [../../todo/172.md](../../todo/172.md) — container validate/parse
  factories; same boundary, does not mention `or`.
