# 665-rtti-json-schema. `toJsonSchema`: print an rtti schema as JSON Schema

**Priority:** P3
**Status:** open

## Problem

rtti can already render a schema as a TypeScript type — `fs/types/rtti/ts/`
(`printer` / `toTs`, mirroring the compile-time `Ts<>`). It has **no** JSON Schema
printer.

[MCP](./665-mcp.md) needs one: a tool declares its `inputSchema` as **JSON
Schema**, so to describe a tool *once* in rtti and expose it over the wire we must
convert the rtti `Type` to a JSON Schema object. The same printer is useful beyond
MCP — anywhere a JSON-Schema consumer (OpenAPI, config docs, external validators)
needs the shape we already describe in rtti.

## Proposal

Add a sibling module `fs/types/rtti/json_schema/module.f.ts` with:

```ts
export const toJsonSchema: (rtti: Type) => json.Unknown
```

It mirrors the visitor structure of `fs/types/rtti/ts/` (`const` / `array` /
`record` / `or` / tag0), but emits a JSON object (`fs/json` `Unknown`) instead of
a string. Target **JSON Schema draft 2020-12** (MCP's dialect).

### Mapping (rtti → JSON Schema)

| rtti | JSON Schema |
|------|-------------|
| `boolean` / `number` / `string` | `{ "type": "boolean" \| "number" \| "string" }` |
| `unknown` | `{}` (the always-true schema) |
| const primitive (`42`, `'x'`, `true`, `null`) | `{ "const": <value> }` |
| const struct `{ a: T, … }` | `{ "type": "object", "properties": { "a": …T… }, "required": [keys without `undefined`], "additionalProperties": false }` |
| const tuple `[A, B]` | `{ "type": "array", "prefixItems": […A…, …B…], "items": false }` |
| `array(T)` | `{ "type": "array", "items": …T… }` |
| `record(T)` | `{ "type": "object", "additionalProperties": …T… }` |
| `or(...types)` | `{ "anyOf": […each…] }` |

### The tricky parts (where JSON Schema and rtti diverge)

- **Optionality.** rtti models optional as `option(T) = or(T, undefined)`. JSON has
  no `undefined`, so optionality is expressed at the *parent struct*: a key whose
  schema admits `undefined` is **omitted from `required`**, and its property schema
  is the union with `undefined` stripped. So the struct printer must compute
  `required` itself (unlike `toTs`, which renders `T | undefined` inline).
- **`bigint`.** Not representable in JSON or JSON Schema. Options: emit
  `{ "type": "integer" }` (lossy — JSON integers are doubles), encode as a string,
  or reject. Decide; likely rare in MCP tool inputs.
- **`null`.** A first-class JSON value — `{ "const": null }` or `{ "type": "null" }`.
- **Tuple dialect.** Draft 2020-12 uses `prefixItems` + `items: false`; older drafts
  use an array-valued `items`. Pin 2020-12.

## Tasks

- [ ] `fs/types/rtti/json_schema/module.f.ts` — `toJsonSchema(rtti)` over the same
      visitor shape as `ts/`
- [ ] struct printer computes `required` from which keys admit `undefined`
- [ ] decide `bigint` handling and document it
- [ ] `proof.f.ts` covering each rtti construct + optional keys + nested schemas
- [ ] register the new `module.f.ts` in `deno.json` exports

## Open questions

- `oneOf` vs `anyOf` for `or` — `anyOf` is the safe default (rtti unions are not
  required to be disjoint).
- Should `additionalProperties` be `false` (strict, matches rtti struct semantics)
  or omitted (lenient)? rtti structs validate-allow extra keys today — align the
  printer with that choice or make it a flag.

## Related

- [i665-mcp](./665-mcp.md) — the consumer (tool `inputSchema`)
- [i665-json-rpc](./665-json-rpc.md) — sibling layer
- `fs/types/rtti/ts/module.f.ts` — the precedent printer (`toTs` / `Ts<>`)
- `fs/types/rtti/module.f.ts` — schema combinators · `fs/json/module.f.ts` — output value type
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)
