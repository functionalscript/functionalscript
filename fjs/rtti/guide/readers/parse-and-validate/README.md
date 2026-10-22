# `parse` and `validate`

**Status:** implemented

```js
const person = open({ name: string, age: number })
const alice = { name: 'Alice', age: 30, admin: true }
parse(person)(alice)     // ['ok', { name: 'Alice', age: 30 }]
validate(person)(alice)  // ['ok', alice] — the same object, `admin` included
```

Both readers walk a schema against a value, both accept exactly the same
values, and both report the same [error](../errors/README.md) on failure.
They differ in what a success carries:

| | `parse` | `validate` |
| --- | --- | --- |
| result on success | a freshly constructed value | the value it was given |
| undeclared member (where admitted) | accepted, absent from the result | accepted, still there |
| absent optional member | still absent | still absent |
| shared member | a copy for each use | still shared |
| `Object.is(result, input)` | false for containers | true |

`parse` is the reader for a value coming *in* — from JSON, from a protocol
frame — where a value built to the schema is what the caller wants next, and
where dropping what the schema does not name is a feature.

`validate` is the reader for a value the caller already holds and must keep. A
content-addressed document is the clear case: its bytes are its identity, so a
reconstruction is a different document under a different hash, and "the payer
did not report this figure" (absent) is not "the payer reported nothing here"
(present, `undefined`). Answering "is this a `T`?" must not edit the thing
being asked about. Against an `open` schema, `validate` also lets a consumer
check the part it understands without discarding the part it does not.

Neither is more fundamental than the other: `validate` is not a `parse` whose
result is thrown away. A third reader, the data form's `validate`, reads the
same values against `toData(s)`, the schema as plain data, and accepts exactly
what the other two do; [`validate/proof.f.mjs`](../../../validate/proof.f.mjs)
runs one acceptance table through all three. How the two schema-form readers
share their code is in
[`common`'s README](../../../common/README.md#one-kernel-two-readers).

A reader over a value that is already built cannot see how it was written. For
reading straight from JSON text against a schema — one pass, no intermediate
value, and a refusal of `1.00000000000000001` against a `bigint` — see
[`rtti-parse`](../../../../media/json/todo/rtti-parse.md).

## Examples

The demo on this page runs the *Built or handed back* lesson:
`open({ name: string, age: number })` against
`{"name":"Alice","age":30,"admin":true}`. Both readers accept it; `parse`'s
answer has no `admin`, and `validate`'s is the value as typed. The lesson is
defined in [`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists it among all the others.

## Reference

- TypeScript: a type is erased at run time, so a check like these is what
  [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
  needs at a boundary; `validate`'s result is typed `Ts<s>`.
- JSON Schema: [validation](https://json-schema.org/understanding-json-schema/basics)
  answers yes or no, as `validate` does; nothing in it builds a value, as
  `parse` does.

## Where it is implemented

[`parse`](../../../parse/module.f.mjs), [`validate`](../../../validate/module.f.mjs)
and the data form's `validate` in [`data`](../../../data/module.f.mjs), over
the shared kernel in [`common`](../../../common/module.f.mjs).
