# Absence: `option`

**Status:** implemented

`option` admits **absence**: the member that is not there. It is a nullary
schema like `boolean`, and a member that may be omitted says so by union.

```js
{ a: or(option, number) }             // `a` may be absent, or a number
{ a: or(number, undefined) }          // `a` must be present, may hold `undefined`
{ a: or(option, number, undefined) }  // absent, a number, or a present `undefined`
[or(option, number), 3]               // position 0 may be a hole
```

Absence is not a spelling of the value `undefined`: `{}` and
`{ a: undefined }` are two distinct values, and only a set admitting absence
accepts the first. A member is **required exactly when its set excludes
absence**, so a struct key or a tuple position without `option` must be there
([structs and tuples are closed](../closed-containers/README.md)).

Absence is observable only at a container position. No caller can hand a
reader an argument that is not there, so a top-level schema admitting absence
accepts exactly what the rest of its union accepts. A container's `rest` never
sees it either, a hole being no member.

Neither reader fills an absent member in: `parse({ a: or(option, number) })({})`
builds `{}`, with no key `a`, and `validate` hands back the `{}` it was given.

## Examples

The [RTTI demo](../../../README.md) shows this in its *Absent vs undefined*
lesson: `{}` is accepted by `{ a: or(option, number) }` and refused by
`{ a: or(number, undefined) }`.

## Reference

- TypeScript: [optional properties](https://www.typescriptlang.org/docs/handbook/2/objects.html#optional-properties).
  `Ts<>` renders `or(option, t)` as an optional key, `a?: Ts<t>`; the
  difference from `undefined` is the one
  [`exactOptionalPropertyTypes`](https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes)
  draws.
- JSON Schema: a key admitting absence is left out of `required`, and a tuple
  position out of `minItems`
  ([object](https://json-schema.org/understanding-json-schema/reference/object))

## Where it is implemented

`option` in [`module.f.mjs`](../../../module.f.mjs); the absent bit of a
member's unit set in [`data`](../../../data/module.f.mjs).
