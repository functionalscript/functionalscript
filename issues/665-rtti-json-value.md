# 665-rtti-json-value. rtti schemas for JSON values (a JSON `unknown`)

**Priority:** P3
**Status:** open

## Problem

rtti's `unknown` schema maps to **djs** `Unknown`:

```ts
// fs/djs
export type Primitive = JsonPrimitive | bigint | undefined   // ← bigint, undefined
export type Unknown   = Primitive | Object | Array
```

So `unknown` accepts `bigint` and `undefined` — values that are **not** valid
JSON. For JSON protocols (JSON-RPC `params`/`result`/`data`, MCP, JSON Schema)
this over-accepts: a `42n` or an `undefined` validates as a "JSON value" when it
isn't one.

It also has a second, subtler effect. A struct field is optional iff its schema
admits `undefined` ([i665-json-rpc](./665-json-rpc.md) discovered this). Because
`unknown` admits `undefined`, **every `unknown`-typed field is optional** — which
is why the JSON-RPC `response` envelope could not be expressed as a schema (a
`result: unknown` field is optional, so "result present" was unenforceable, and a
response with neither `result` nor `error` validated). A JSON value type that
*excludes* `undefined` makes such a field required-when-present, restoring that
ability.

## Proposal

`fs/json` already names the JSON value type `Unknown`
(`Primitive | Object | Array`, where `Primitive = boolean | string | number | null`
— no `bigint`/`undefined`). Provide the **rtti schema** that mirrors it, reusing
that name: a JSON `unknown`, exactly parallel to how rtti core's `unknown` schema
corresponds to djs `Unknown`.

Home: a new **`fs/types/rtti/json/module.f.ts`** — a `json` sub-module of rtti.
Keep these JSON-specific schemas out of rtti core (`fs/types/rtti/module.f.ts`),
which stays value-system-agnostic:

```ts
import { boolean, number, string, or, array, record } from '../module.f.ts'

const primitive = or(boolean, number, string, null)   // mirrors fs/json `Primitive`

// recursive: a JSON value is a primitive, an array of values, or an object of values
export const unknown = () =>
    ['or', boolean, number, string, null, array(unknown), record(unknown)] as const
```

(rtti already supports recursive schemas via self-referencing thunks — see the
`_SelfArrayType` precedent in `fs/types/rtti/ts/`.)

The key invariant, to be asserted with a type test — the rtti `unknown` recovers
the `fs/json` `Unknown` type exactly:

```ts
type _ = Assert<Equal<Ts<typeof unknown>, Unknown>>   // fs/json Unknown, no bigint/undefined
```

So `fs/types/rtti/json`'s `unknown` is "any JSON value," and — unlike rtti core's
`unknown` — a struct field typed with it is **required when present** (it does
not silently admit `undefined`).

The `Ts<>` invariant pulls the `Unknown` type from `fs/json`
(`import type { Unknown } from '../../../json/module.f.ts'`).

## Consumers / why now

- **i665-json-rpc** — import `unknown` from `fs/types/rtti/json` instead of rtti
  core for `params`, `result`, `data`. Stops accepting non-JSON `bigint`/`undefined`,
  and lets the `response` envelope become a real rtti schema again (`result: unknown`
  is now required), so runtime response decoding (deferred there) becomes feasible.
  Note: with the JSON `unknown`, optionality must be made explicit again —
  `params: option(unknown)` for an optional field vs `result: unknown` for a
  required one (the djs-`unknown` shortcut where the field was implicitly optional
  no longer applies).
- **i665-mcp** — MCP payloads are JSON; tool arguments and results use the JSON
  `unknown`, not djs `unknown`.
- **i665-rtti-json-schema** — `toJsonSchema` over the JSON `unknown` is the natural
  "any JSON" schema (`{}`), and the JSON-only domain simplifies the printer's
  `bigint` question.

## Decisions

- **Module location.** `fs/types/rtti/json/module.f.ts` — a `json` sub-module of
  rtti. JSON-specific schemas stay **out** of rtti core (`fs/types/rtti/module.f.ts`),
  which remains value-system-agnostic; rtti gains a JSON tier as a sibling module,
  not by mixing JSON types into core.
- **Naming.** Reuse `unknown` (matching `fs/json`'s `Unknown` type and rtti core's
  `unknown` schema) rather than inventing `jsonValue`. Because it lives in its own
  module, a consumer picks the JSON one via `import { unknown } from
  '.../rtti/json/module.f.ts'`; a module needing both tiers aliases one. Add
  `primitive` if a bare-primitive schema is useful.

## Open questions

- **Recursion cost.** Confirm `Ts<typeof unknown>` resolves (no infinite
  instantiation) and that `validate(unknown)` terminates on cyclic-free input —
  rtti instantiates container item validators lazily, so this should hold; verify
  with proofs.

## Related

- [i665-json-rpc](./665-json-rpc.md) — first consumer; documents the `unknown`-is-optional footgun
- [i665-mcp](./665-mcp.md) · [i665-rtti-json-schema](./665-rtti-json-schema.md)
- `fs/types/rtti/module.f.ts` — combinators + recursion · `fs/json/module.f.ts` — the `Unknown` type to match
