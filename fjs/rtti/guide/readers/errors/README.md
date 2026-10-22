# Errors

**Status:** implemented

A reader answers with a `Result`: `['ok', value]` or
`['error', { path, message }]`. It never throws on a value it refuses.

```js
const order = { items: array({ sku: string, qty: number }) }
parse(order)({ items: [{ sku: 'A1', qty: 2 }, { sku: 'B2', qty: '3' }] })
// ['error', { path: ['items', '1', 'qty'], message: 'unexpected value' }]
```

`path` is the list of keys from the root to the member the reader refused, an
array index written as a string. `message` is one of two words:

| message | means |
| --- | --- |
| `unexpected value` | the value is not of the schema's kind or not its constant, a required member is absent, or a closed container has a member it does not declare |
| `no match` | no member of an `or` admits the value |

A union does not say which member came closest: `or` tries each member and
reports `no match` at the union's own path. So
`or({ kind: 'a', x: number }, { kind: 'b', y: string })` refuses
`{ kind: 'a', x: '1' }` with the path `[]`, not `['x']`.

`parse` and `validate` report the same error for the same value: they read a
container in the same order and stop at the same first failure
([`parse` and `validate`](../parse-and-validate/README.md)). For a closed
container that order settles the **shape** before reading any member — a
missing required key, then an undeclared member, then the members one by
one — so `{ a: number, b: number }` refuses `{ a: 'x' }` at `['b']`, the absent
key, rather than at `['a']`. A container with a stated rest reads its declared
members first, in order, and only then the undeclared ones against the rest:
`rest({ a: number }, string)` refuses `{ a: 'x', extra: 0 }` at `['a']`.

The data form's `validate` refuses the same DataJS values (outside DataJS it is
more permissive; see
[`data-validate-admits-non-djs-values`](../../../todo/data-validate-admits-non-djs-values.md))
but reads in its own order,
so its path can name another member: against `{ a: number }` it refuses
`{ a: 1, b: 2 }` at `['b']`, where the schema-form readers answer `[]`, the
container. Use the schema-form readers' path when the exact member matters.

## Examples

The demo on this page runs the *Where it failed* lesson:
`{ items: array({ sku: string, qty: number }) }` against an order whose second
item has `"3"` for its quantity. Both readers refuse it at
`items → 1 → qty`, and the demo marks that member in the value. Make the
quantity a number to see both accept it. The lesson is defined in
[`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists it among all the others.

## Reference

- TypeScript: a [discriminated union](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
  narrows by its tag; a reader does not, which is why a union refuses as a
  whole.
- JSON Schema: an [output format](https://json-schema.org/draft/2020-12/json-schema-core#name-output-formatting)
  reports an `instanceLocation`, the counterpart of `path`.

## Where it is implemented

`ValidationError` in [`common/types.ts`](../../../common/types.ts); `verror`,
`prependPath` and `orVisit` in [`common`](../../../common/module.f.mjs).
