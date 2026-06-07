# 665-json-schema-type. A type for JSON Schema documents (`fs/json/schema`)

**Priority:** P3
**Status:** open

## Problem

We produce JSON Schema from `fs/json/schema/module.f.ts`'s `toJsonSchema`, and
an MCP server will eventually *consume* it (a tool's `inputSchema` arrives as
JSON Schema from a peer). But we have no type for "a JSON Schema document" — so
`toJsonSchema` would have to return the untyped `json.Unknown`, and any consumer
would hand-walk a bag of unknown keys.

We need a module — `fs/json/schema/module.f.ts` — that names the shape of a JSON
Schema (draft 2020-12, the dialect MCP uses), at least the subset we use.

## Proposal

Build it in two phases; only go as far as the actual need.

### Phase 1 — TypeScript type (produce)

A hand-written `JsonSchema` TypeScript type covering the keywords we emit/read:

```ts
export type JsonSchema =
    | boolean                                   // `true` / `false` are valid schemas in 2020-12
    | {
        readonly type?: JsonType | readonly JsonType[]
        readonly const?: json.Unknown
        readonly enum?: readonly json.Unknown[]
        // object
        readonly properties?: { readonly [k: string]: JsonSchema }
        readonly required?: readonly string[]
        readonly additionalProperties?: JsonSchema
        // array
        readonly items?: JsonSchema
        readonly prefixItems?: readonly JsonSchema[]
        // combinators
        readonly anyOf?: readonly JsonSchema[]
        readonly oneOf?: readonly JsonSchema[]
        // annotations
        readonly title?: string
        readonly description?: string
        // … grow as needed: $ref/$defs, format, min/max, pattern …
    }

type JsonType = 'null' | 'boolean' | 'object' | 'array' | 'number' | 'integer' | 'string'
```

This is enough to give `toJsonSchema` a real return type (`JsonSchema` instead of
`json.Unknown`) and to type any code that builds JSON Schema by hand. Producing a
value never needs runtime validation of the schema *language* itself.

### Phase 2 — RTTI schema (parse), only if we consume external JSON Schema

If/when we need to accept JSON Schema from an untrusted peer (e.g. an MCP proxy
reading someone else's tool `inputSchema`), re-express the same shape as an **rtti**
schema. Then `validate(jsonSchema)(value)` decodes it at runtime, and `Ts<typeof
jsonSchema>` recovers the Phase-1 type — collapsing the two into one declaration
(no hand-written type to keep in sync). JSON Schema is recursive, which rtti
already supports via thunks (see the `_SelfArrayType` precedent in
`fs/types/rtti/ts/`).

Until that parse requirement is real, Phase 2 is speculative — stay at Phase 1.

## Relationship to the other issues

- `fs/json/schema/module.f.ts` — `toJsonSchema` *emits* values
  of this type; this issue gives that output a name. The two are duals: one rtti
  schema → JSON Schema (printer), this one a type/validator *for* JSON Schema.
- [i665-mcp](./665-mcp.md) — the consumer that may eventually force Phase 2.

## Open questions

- **Subset vs full draft.** JSON Schema 2020-12 is large. Start with the keywords
  `toJsonSchema` emits (`type`, `const`, `properties`, `required`,
  `additionalProperties`, `items`, `prefixItems`, `anyOf`) and grow on demand.
- **`integer` vs `number`.** JSON Schema distinguishes them; decide how `bigint` /
  whole-number rtti types map.
- **Go straight to RTTI?** If a parse need is already on the horizon, Phase 1 and 2
  could collapse — but the default is TS-first to avoid building the full
  meta-schema before it is needed.

## Related

- `fs/json/schema/module.f.ts` · [i665-mcp](./665-mcp.md)
- `fs/json/module.f.ts` — `Unknown` (the value type JSON Schema is built from)
- `fs/types/rtti/module.f.ts` — combinators + recursion (`Ts<>`) for Phase 2
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)
