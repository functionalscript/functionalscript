# 665-rtti-json-value. rtti schemas for JSON values (`fs/json/rtti`)

**Priority:** P3
**Status:** done

## Problem

rtti's `unknown` schema maps to `Primitive | Array | Object` where `Primitive`
includes `bigint` and `undefined` — values that are **not** valid JSON. For JSON
protocols (JSON-RPC `params`/`result`/`data`, MCP, JSON Schema) this over-accepts.

There is also a struct-field-optionality side effect: a field is optional iff its
schema admits `undefined`. Because rtti `unknown` admits `undefined`, every
`unknown`-typed field is implicitly optional — which prevented the JSON-RPC
`response` envelope from being expressed as an rtti schema (`result: unknown` was
optional, making "result present" unenforceable). A JSON value type that excludes
`undefined` makes such a field required-when-present.

Additionally, rtti core (`fs/types/rtti/module.f.ts`) previously imported
`Primitive` from `fs/djs/module.f.ts`, creating an rtti → djs dependency. Since
djs depends on rtti (not the other way around), this was a layering violation
(see [i665-rtti-defines-types](./665-rtti-defines-types.md)).

## Implementation

### rtti core decoupled from djs

`Primitive` is now defined locally in `fs/types/rtti/module.f.ts`:

```ts
export type Primitive = null | boolean | number | string | undefined | bigint
```

And `fs/types/rtti/ts/module.f.ts` defines its own `Unknown` (no djs import):

```ts
export type Unknown = Primitive | Array | Object
```

### `fs/json/rtti/module.f.ts` — JSON rtti schemas

A new module at `fs/json/rtti/` (under `fs/json`, not under `fs/types/rtti/`,
keeping rtti core value-system-agnostic) provides the JSON-specific schemas:

```ts
import { boolean, number, or, string, record, array as rttiArray } from '../../types/rtti/module.f.ts'

export const primitive = or(null, boolean, number, string)   // no bigint / undefined

export const unknown = () => ['or', primitive, object, array] as const

export const object = record(unknown)

export const array = rttiArray(unknown)
```

`Ts<typeof unknown>` resolves to `fs/json`'s `Unknown` type
(`boolean | string | number | null | Object | Array` — no `bigint`/`undefined`).

### `fs/json/rpc/module.f.ts` consumes it

```ts
import { unknown } from '../rtti/module.f.ts'   // fs/json/rtti — JSON unknown
import type { Unknown } from '../module.f.ts'    // fs/json Unknown type
```

`params: option(unknown)` (explicitly optional) and `data: option(unknown)`,
`result: unknown` (required — excludes `undefined`).

## Related

- [i665-rtti-defines-types](./665-rtti-defines-types.md) — the rtti → djs layering violation this also fixed
- [i665-json-rpc](./665-json-rpc.md) — first consumer
- [i665-mcp](./665-mcp.md) · [i665-rtti-json-schema](./665-rtti-json-schema.md)
- `fs/json/rtti/module.f.ts` — implementation · `fs/json/module.f.ts` — the `Unknown` type it mirrors
