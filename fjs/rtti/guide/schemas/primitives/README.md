# Primitives

**Status:** implemented

`boolean`, `number`, `string` and `bigint` each admit every value of that
JavaScript kind. `unknown` admits any DataJS value.

| Schema | Admits | `Ts<>` | JSON Schema |
| --- | --- | --- | --- |
| `boolean` | `true`, `false` | `boolean` | `{ "type": "boolean" }` |
| `number` | any number, `NaN` and the infinities included | `number` | `{ "type": "number" }` |
| `string` | any string | `string` | `{ "type": "string" }` |
| `bigint` | any bigint | `bigint` | `{ "type": "integer" }`, lossy |
| `unknown` | any DataJS value | `Unknown`, the DataJS value type | `{}` |

Each is a thunk returning a one-element tag, `['number']` for `number`, so a
schema can tell a built-in from a [constant](../constants/README.md) without
comparing values. A primitive and the union of all its constants are one set:
`or(true, false)` and `boolean` are written differently and accept the same
values, which the data form's `equal` confirms
([unions](../unions/README.md)).

## Examples

The [RTTI demo](../../../README.md) compares `or(true, false)` with `boolean`
in its *Two spellings, one set* lesson.

## Reference

- TypeScript: [the primitives](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#the-primitives-string-number-and-boolean)
  and [`unknown`](https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown)
- JSON Schema: `type`
  ([reference](https://json-schema.org/understanding-json-schema/reference/type))

## Where it is implemented

The nullary schemas in [`module.f.mjs`](../../../module.f.mjs); the kind
checks in [`common`](../../../common/module.f.mjs).
