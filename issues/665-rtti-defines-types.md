# 665-rtti-defines-types. rtti must not depend on djs

**Priority:** P3
**Status:** done

## Problem

`fs/types/rtti/module.f.ts` imported `Primitive` from `fs/djs/module.f.ts`:

```ts
import type { Primitive } from '../../djs/module.f.ts'
```

This created an rtti → djs dependency. The correct layering is the opposite:
djs depends on rtti (djs values are the domain rtti schemas validate), not the
other way around. rtti is a foundational type system; it should have no
knowledge of djs-specific value shapes.

## Fix

Removed the `djs` import from `fs/types/rtti/module.f.ts` and defined `Primitive`
locally:

```ts
export type Primitive = null | boolean | number | string | undefined | bigint
```

`fs/types/rtti/ts/module.f.ts` similarly stopped importing `DjsUnknown` and now
defines its own `Unknown` type:

```ts
export type Unknown = Primitive | Array | Object
```

These rtti-local definitions are deliberately broader than `fs/json`'s `Unknown`
(which excludes `bigint`/`undefined`) — rtti core stays value-system-agnostic.
JSON-specific schemas live in `fs/json/rtti/` (see
[i665-rtti-json-value](./665-rtti-json-value.md)).

## Related

- [i665-rtti-json-value](./665-rtti-json-value.md) — the JSON rtti tier that motivated this cleanup
