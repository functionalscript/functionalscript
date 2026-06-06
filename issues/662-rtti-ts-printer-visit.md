# 662. RTTI `ts` printer: walk the `Type` ADT through the shared `visit`

**Priority:** P4
**Status:** open

## Problem

`fs/types/rtti/common/module.f.ts` exports `visit` — a visitor over the
`Type` ADT — and its module header states its purpose plainly:

> Shared kernel for RTTI consumers (`validate`, `parse`).
> …
> `visit`: a visitor over the `Type` ADT. Callers supply a `Visitor<R>`
> with one handler per variant; `visit(v)(rtti)` recognizes `rtti` and
> calls the matching handler. Both consumers compose their top-level
> function from a visitor.

`visit` does the whole job of recognizing a schema: evaluate a `Thunk`
once, switch on its tag (`const` / `array` / `record` / `unknown` / `or` /
a `Tag0` primitive), and route a bare `Const` through `visitConst`
(tuple / struct / `constPrimitive`).

```ts
// fs/types/rtti/common/module.f.ts:124
export const visit = <R>(v: Visitor<R>) => (rtti: Type): R => {
    if (typeof rtti === 'function') {
        const [tag, ...value] = rtti()
        switch (tag) {
            case 'const': return visitConst(v)(value[0] as Const)
            case 'array': return v.array(value[0])
            case 'record': return v.record(value[0])
            case 'unknown': return v.unknown()
            case 'or': return v.or(value)
        }
        return v.primitive0(tag as Primitive0)
    }
    return visitConst(v)(rtti)
}
```

```ts
// fs/types/rtti/common/module.f.ts:99
const visitConst = <R>(v: Visitor<R>) => (c: Const): R =>
    typeof c === 'object' && c !== null
        ? (commonIsArray(c) ? v.tuple(c) : v.struct(c as Struct))
        : v.constPrimitive(c as Primitive)
```

`validate` and `parse` both compose their top-level function from a
`Visitor<R>` and call `visit(...)`. But there is a **third** walker over
the same `Type` ADT in the same `rtti/` tree — the runtime `printer` in
`fs/types/rtti/ts/module.f.ts` — and it never adopted `visit`. It
re-hand-rolls the identical recognition logic:

```ts
// fs/types/rtti/ts/module.f.ts:118
export const printer = (mut?: true): (rtti: Type) => string => {
    const { tuple, struct, array, record } = tsPrinter(mut)

    const constToTs = (rtti: Const): string =>
        typeof rtti !== 'object' || rtti === null ? primitive(rtti) :
        rtti instanceof Array ? tuple(rtti.map(toTs)) :
        struct(Object.entries(rtti).map(([k, v]) => [k, toTs(v)]))

    const toTs = (rtti: Type): string => {
        if (typeof rtti !== 'function') { return constToTs(rtti) }
        const [tag, ...rest] = rtti()
        switch (tag) {
            case 'const': return constToTs(rest[0] as Const)
            case 'array': return array(toTs(rest[0]))
            case 'record': return record(toTs(rest[0]))
            case 'or': return union(rest.map(toTs))
            default: return tag // tag0: 'boolean' | 'number' | 'string' | 'bigint' | 'unknown'
        }
    }

    return toTs
}
```

`constToTs` is `visitConst` with the leaves swapped (`primitive` / `tuple` /
`struct` instead of `constPrimitive` / `tuple` / `struct`). The `toTs`
`switch` is the `visit` `switch` with `array` / `record` / `or` swapped
for printer leaves and the `default` arm returning the tag string. The
schema-recognition skeleton — the part `visit` exists to own — is copied
verbatim, including the `typeof rtti === 'function'` thunk gate, the
`rtti()` evaluation, the array-vs-object Const split, and the
`null`-as-primitive handling.

## Proposal

Express the printer as a `Visitor<string>` and delegate recognition to
`visit`. Every printer leaf maps one-to-one onto a visitor handler, so the
hand-rolled `constToTs` and the `toTs` switch both disappear:

```ts
import { visit, type Visitor } from '../common/module.f.ts'

export const printer = (mut?: true): (rtti: Type) => string => {
    const { tuple, struct, array, record } = tsPrinter(mut)
    const visitor: Visitor<string> = {
        tuple:          t  => tuple(t.map(toTs)),
        struct:         s  => struct(Object.entries(s).map(([k, v]) => [k, toTs(v)])),
        array:          e  => array(toTs(e)),
        record:         e  => record(toTs(e)),
        or:             vs => union(vs.map(toTs)),
        constPrimitive: c  => primitive(c),
        primitive0:     t  => t,           // 'boolean' | 'number' | 'string' | 'bigint'
        unknown:        () => 'unknown',
    }
    const toTs = visit(visitor)
    return toTs
}
```

The handlers reference `toTs` (the recursive call), which is `visit(visitor)`;
the arrow functions capture the `toTs` binding, and no handler runs during
construction, so the const-before-use is safe — the same lazy-recursion
shape `validate`/`parse` already rely on.

This is **separation of concerns**, not just DRY: schema recognition
(thunk gate, tag switch, Const split, null handling) belongs in the one
place that owns the `Type` ADT shape — `common.visit` — and the printer
should own only the *rendering* of each variant. Today the printer owns
both, so a future `Type` variant (a new `Tag1`, say) has to be added to
`visit`'s switch **and** to `toTs`'s switch independently; with this
change the printer gets a compile error from `Visitor<string>` until it
supplies the new leaf, which is exactly the safety `validate`/`parse`
already enjoy.

## Why the mapping is exact

| `visit` routes to | current printer code | visitor handler |
|---|---|---|
| `v.tuple(c)` (Const array) / `'const'`→array | `tuple(rtti.map(toTs))` | `t => tuple(t.map(toTs))` |
| `v.struct(c)` (Const object) | `struct(Object.entries(rtti)…)` | `s => struct(Object.entries(s)…)` |
| `v.constPrimitive(c)` | `primitive(rtti)` | `c => primitive(c)` |
| `v.array(e)` | `array(toTs(rest[0]))` | `e => array(toTs(e))` |
| `v.record(e)` | `record(toTs(rest[0]))` | `e => record(toTs(e))` |
| `v.or(value)` | `union(rest.map(toTs))` | `vs => union(vs.map(toTs))` |
| `v.primitive0(tag)` | `default: return tag` | `t => t` |
| `v.unknown()` | `default: return tag` (`'unknown'`) | `() => 'unknown'` |

The two behaviours the printer documents in its JSDoc are preserved:

- **`unknown` prints the literal `'unknown'`** (TS built-in), not
  `DjsUnknown`. In `visit`, `'unknown'` is a *separate* arm
  (`case 'unknown': return v.unknown()`), distinct from the `Tag0`
  primitives, so `unknown: () => 'unknown'` keeps the documented string
  while `primitive0: t => t` covers `'boolean' | 'number' | 'string' |
  'bigint'`. The current code lumps both into the `default` arm; the split
  is harmless because both arms produce the tag string anyway.
- **`null` Const prints as a primitive.** `visitConst` routes
  `typeof c === 'object' && c !== null` away from `constPrimitive`, so
  `null` falls to `v.constPrimitive(null)` → `primitive(null)`, matching
  `constToTs`'s `rtti === null ? primitive(rtti)` guard.

`tsPrinter`'s leaf signatures already line up with the visitor:
`tuple: (string[]) => string`, `struct: ([string,string][]) => string`,
`array: (string) => string`, `record: (string) => string`
(`fs/types/ts/module.f.ts:23-29`), with `union` and `primitive` from the
same module (`:44`, `:55`).

## Why this qualifies

- **Separation of concerns** (always appropriate per `AGENTS.md`, no
  second-consumer bar required): the `Type`-ADT recognition skeleton has a
  natural home — `common.visit` — and the printer is currently the only
  RTTI walker that keeps a private copy of it instead of importing it.
- **DRY at the right altitude**: `visit` already serves `validate` and
  `parse`; the printer is the third real consumer of the same walk. The
  skeleton (`typeof === 'function'` gate, `rtti()` eval, tag switch,
  array/object Const split, null handling) is currently maintained twice.
- **Removes `as` casts.** `toTs` carries `rest[0] as Const`; `visit`/`visitConst`
  already localise the unavoidable casts (`value[0] as Const`,
  `c as Primitive`) inside `common`, so the printer's visitor handlers
  need none — aligning with the `AGENTS.md` push to avoid `as`.

## Caveats / why this is an idea, not a mechanical edit

- **Import direction / cycle.** `common` already does
  `import type { Ts } from '../ts/module.f.ts'` (type-only). Adding
  `import { visit } from '../common/module.f.ts'` to `ts` makes the two
  modules co-dependent at compile time. At **runtime** the edge is
  one-directional (`ts → common`; the `common → ts` import is `import type`
  and erased), so there is no initialization-order hazard — but confirm
  `npx tsc` and `npm test` stay green, since circular type graphs
  occasionally surface `slow types` complaints under JSR
  ([i147](./147-deno-slow-types.md)).
- **Generic inference.** Unlike `validate`/`parse`, whose visitors return a
  generic `Validate<T>` and lean on a top-level `as any`
  ([i146](./146-rtti-ts-inference.md)), the printer's visitor is
  monomorphic (`Visitor<string>`), so it should type cleanly with **no**
  cast. If TS nonetheless balks at one of the handler parameter types
  (`Struct`, `Primitive`), prefer fixing the handler signature over
  reintroducing `as`.
- **Scope.** This is independent of [i172](./172-rtti-validate-parse-skeleton.md),
  which proposes merging the `validate`/`parse` **container factories**.
  That is about the value-walk; this is about the schema-walk in the
  printer. Either can land without the other.

## Related

- [i172](./172-rtti-validate-parse-skeleton.md) — unify `validate`/`parse`
  container walks; complementary RTTI consolidation along the same kernel.
- [i146](./146-rtti-ts-inference.md) — the `Ts<T>` inference / `as any`
  problem in the generic visitors; the printer's visitor avoids it by being
  monomorphic.
- [i197](./197-djs-unknown-walker.md) — a sibling "adopt a shared visitor"
  proposal, but over runtime `Unknown` *values* rather than the `Type`
  schema ADT; same spirit, different walk.
- [i143](./143-rtti-data.md) — the prospective fourth `Type`-ADT consumer
  (the serializable data form); a printer already on `visit` is one fewer
  fork it has to reconcile with.

- `fs/types/rtti/common/module.f.ts:99,124` — `visitConst` / `visit`, the
  shared schema walker.
- `fs/types/rtti/ts/module.f.ts:118-145` — the printer's duplicated
  `constToTs` + `toTs` switch.
- `fs/types/ts/module.f.ts:23-29,44,55` — the printer leaves the visitor
  handlers delegate to.
