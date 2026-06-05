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

Define a small set of rtti schemas for JSON values — the JSON analog of rtti's
`unknown` — proposed home `fs/json/rtti/module.f.ts`:

```ts
import { boolean, number, string, or, array, record } from '../../types/rtti/module.f.ts'

const jsonPrimitive = or(boolean, number, string, null)   // no bigint / undefined

// recursive: a JSON value is a primitive, array of values, or object of values
const jsonValue = () =>
    ['or', boolean, number, string, null, array(jsonValue), record(jsonValue)] as const

const jsonArray  = array(jsonValue)
const jsonObject = record(jsonValue)
```

(rtti already supports recursive schemas via self-referencing thunks — see the
`_SelfArrayType` precedent in `fs/types/rtti/ts/`.)

The key invariant, to be asserted with a type test:

```ts
type _ = Assert<Equal<Ts<typeof jsonValue>, json.Unknown>>   // fs/json Unknown, no bigint/undefined
```

So `jsonValue` is "any JSON value," and — unlike `unknown` — a struct field typed
`jsonValue` is **required when present** (it does not silently admit `undefined`).

## Consumers / why now

- **i665-json-rpc** — replace `unknown` with `jsonValue` for `params`, `result`,
  `data`. Stops accepting non-JSON `bigint`/`undefined`, and lets the `response`
  envelope become a real rtti schema again (`result: jsonValue` is required), so
  runtime response decoding (deferred there) becomes feasible.
- **i665-mcp** — MCP payloads are JSON; tool arguments and results should be
  `jsonValue`, not djs `unknown`.
- **i665-rtti-json-schema** — `toJsonSchema` over `jsonValue` is the natural
  "any JSON" schema (`{}`), and the JSON-only domain simplifies the printer's
  `bigint` question.

## Open questions

- **Module location.** `fs/json/rtti/` (JSON-flavored rtti, under `json`) vs
  `fs/types/rtti/json/` (under `rtti`). These schemas depend on rtti combinators
  but describe `fs/json` values — leaning `fs/json/rtti/`.
- **Naming.** `jsonValue` for the union (the "JSON `unknown`"), plus
  `jsonPrimitive` / `jsonArray` / `jsonObject`. Avoid shadowing rtti's `unknown`.
- **Recursion cost.** Confirm `Ts<typeof jsonValue>` resolves (no infinite
  instantiation) and that `validate(jsonValue)` terminates on cyclic-free input —
  rtti instantiates container item validators lazily, so this should hold; verify
  with proofs.
- **Should rtti itself ship a JSON tier?** Keep JSON-specific schemas in
  `fs/json` (they describe JSON), with rtti staying value-system-agnostic.

## Related

- [i665-json-rpc](./665-json-rpc.md) — first consumer; documents the `unknown`-is-optional footgun
- [i665-mcp](./665-mcp.md) · [i665-rtti-json-schema](./665-rtti-json-schema.md)
- `fs/types/rtti/module.f.ts` — combinators + recursion · `fs/json/module.f.ts` — the `Unknown` type to match
