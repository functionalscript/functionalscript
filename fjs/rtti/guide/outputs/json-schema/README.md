# JSON Schema

**Status:** implemented

`toJsonSchema(s)` writes a schema as a
[JSON Schema](https://json-schema.org/) of draft 2020-12, the form an MCP
server advertises as a tool's `inputSchema`.

```js
toJsonSchema({ id: bigint, note: or(option, string) })
// { "type": "object",
//   "properties": { "id": { "type": "integer" }, "note": { "type": "string" } },
//   "required": ["id"],
//   "additionalProperties": { "not": {} } }
```

It goes through the [data form](../data-form/README.md), so two spellings of
one set usually write one JSON Schema (the exceptions are the data form's own
[known limits](../data-form/README.md)), a union's members come in canonical
order, and a recursive schema is written once under `$defs` and referred to with `$ref`.

| rtti | JSON Schema |
| --- | --- |
| `boolean`, `number`, `string` | `{ "type": … }` |
| `bigint` | `{ "type": "integer" }` |
| `unknown` | `{}` |
| `never`, the constant `undefined` | `{ "not": {} }` |
| a constant | `{ "const": … }` |
| a struct | `properties`, `required` for the keys excluding absence, `additionalProperties` for the rest |
| a tuple | `prefixItems`, `minItems` for the positions excluding absence, `items` for the rest |
| `array(t)`, `record(t)` | `items`, `additionalProperties` |
| `or(…)` | `anyOf`, or one `type` when the union is a whole kind |

JSON cannot write every value a schema describes, so the conversion is
**lossy**. These are the cases:

- a `bigint` becomes an integer, and a bigint constant the nearest double:
  `9007199254740993n` is written `9007199254740992`;
- `-0` is a constant of its own to rtti, but JSON Schema compares numbers by
  value, so `toJsonSchema(-0)`, `{ "const": -0 }`, admits `0` as well;
- `undefined` has no JSON value, so the constant becomes `{ "not": {} }`;
- `NaN` and the infinities are numbers to rtti and not JSON values at all;
- JSON has no holes, so absence is kept only at the end of a tuple:
  `[or(option, number), string]` admits `[, 'x']`, and its JSON Schema
  requires both positions (`"minItems": 2`).

## Examples

The demo on this page runs the *Lossy integers* lesson:
`{ id: bigint, max: 9007199254740993n, note: or(option, string) }`, whose JSON
Schema has `"type": "integer"` for `id`, the constant `9007199254740992` for
`max`, and only `id` and `max` under `required`. The lesson is defined in
[`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists it among all the others.

## Reference

- JSON Schema: [the reference](https://json-schema.org/understanding-json-schema/reference)
  and [`$defs` and `$ref`](https://json-schema.org/understanding-json-schema/structuring)

## Where it is implemented

`toJsonSchema` and `dataToJsonSchema` in
[`media/json/schema`](../../../../media/json/schema/module.f.mjs), which
also declares JSON Schema itself as an rtti schema.
