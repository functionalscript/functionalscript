# 666-json-schema-visit. Route `toJsonSchema` through `rtti/common.visit`

**Priority:** P3
**Status:** open

## Problem

`fs/types/rtti/common/module.f.ts` exports `visit` — the "shared kernel for RTTI
consumers", a `Visitor<R>` over the `Type` ADT. `validate` and `parse` both
delegate schema recognition to it (`fs/types/rtti/validate/module.f.ts:176`,
`fs/types/rtti/parse/module.f.ts:202`). Issue [i662](./662-rtti-ts-printer-visit.md)
proposes routing the `ts` printer through it too, as a *third* consumer.

`toJsonSchema` is a **fourth** hand-rolled walker over the same ADT, and i662 does
not mention it. Its own module doc even says it "mirrors the visitor structure of
`fs/types/rtti/ts/`" — i.e. it copies the exact skeleton i662 wants to eliminate.
The recognition logic is duplicated verbatim:

```ts
// fs/json/schema/module.f.ts:119-135      // fs/types/rtti/common/module.f.ts:124-137
export const toJsonSchema = (rtti) => {     export const visit = v => rtti => {
  if (typeof rtti !== 'function')             if (typeof rtti === 'function') {
    { return constToJsonSchema(rtti) }          const [tag, ...value] = rtti()
  const [tag, ...rest] = rtti()                 switch (tag) {
  switch (tag) {                                  case 'const': return visitConst(v)(value[0] as Const)
    case 'const': return constToJsonSchema(...)   case 'array': return v.array(value[0])
    case 'array': return {type:'array', ...}      case 'record': return v.record(value[0])
    case 'record': return {type:'object', ...}    case 'unknown': return v.unknown()
    case 'or': return {anyOf: rest.map(...)}       case 'or': return v.or(value)
    ...                                          }
                                                  return v.primitive0(tag as Primitive0)
                                                }
                                                return visitConst(v)(rtti)
```

and `constToJsonSchema` (`fs/json/schema/module.f.ts:72-100`) is `visitConst`
(`common:94-97`) with the leaves swapped — same `typeof !== 'object' || === null`
primitive test, same `instanceof Array` tuple-vs-struct split. The thunk gate, the
`rtti()` evaluation, the `Const` array/object split, and `null`-as-primitive are all
maintained a fourth time, each behind an `as Const` cast (`json/schema:123`) that
`visit`/`visitConst` already localize inside `common`.

With four independent copies, any new `Type` variant must be added in four places
with no compiler help. `validate`/`parse` get exhaustiveness safety from the
`Visitor<R>` shape; `toJsonSchema` doesn't.

## Proposal

Express `toJsonSchema` as a `Visitor<Unknown>` and let `visit` own recognition —
the same move i662 proposes for the `ts` printer:

```ts
import { visit, type Visitor } from '../../types/rtti/common/module.f.ts'

const visitor: Visitor<Unknown> = {
    tuple:          t  => ({ type: 'array', prefixItems: t.map(toJsonSchema), items: false }),
    struct:         s  => structSchema(s),        // keeps required/stripUndefined logic (:88-99)
    array:          e  => ({ type: 'array', items: toJsonSchema(e) }),
    record:         e  => ({ type: 'object', additionalProperties: toJsonSchema(e) }),
    or:             vs => ({ anyOf: vs.map(toJsonSchema) }),
    constPrimitive: c  => constPrimitiveSchema(c), // bigint→{const:Number}, undefined→{not:{}}, null→{const:null}
    primitive0:     t  => ({ type: t === 'bigint' ? 'integer' : t }),
    unknown:        () => ({}),
}
export const toJsonSchema = visit(visitor)
```

The JSON-Schema-specific bits stay in the handlers: the struct handler keeps its
`required`/`stripUndefined`/`admitsUndefined` computation, and `constPrimitive`
keeps the `bigint`→`Number`, `undefined`→`{not:{}}`, `null`→`{const:null}` special
cases. `visitConst` already routes `null` to `constPrimitive`, matching the current
`rtti === null` guard.

This is a separation-of-concerns fix (no second-consumer bar needed — `visit` is
already the home for this walk). `json/schema` already imports from `rtti`, so no
import cycle is introduced (cleaner than i662's `ts→common` case). The visitor is
monomorphic (`Visitor<Unknown>`), so no top-level `as`/`any` is needed.

**Best landed together with i662** as "route *all* remaining `Type`-ADT printers
through `visit`."

## Tasks

- [ ] rewrite `toJsonSchema` as a `Visitor<Unknown>` driven by `visit`
- [ ] move struct/`constPrimitive` JSON-Schema specifics into handlers, drop the `as Const` cast
- [ ] confirm `fs/json/schema/proof.f.ts` passes unchanged (pure refactor)

## Related

- [i662](./662-rtti-ts-printer-visit.md) — same move for the `ts` printer; land together
- [i172](./172-rtti-validate-parse-skeleton.md) — the `validate`/`parse` container skeleton
- `fs/types/rtti/common/module.f.ts` — `visit` (:124), `Visitor` (:83)
- `fs/json/schema/module.f.ts` — `toJsonSchema` (:119), `constToJsonSchema` (:72)
