# Undefined-Valued Properties

In FunctionalScript, a property whose value is `undefined` is semantically
equivalent to the property not existing:

```ts
{ x: undefined }  ≡  {}
```

This is consistent with JSON (which has no concept of `undefined`) and with
`JSON.stringify`, which omits `undefined`-valued properties. It also aligns with
TypeScript's optional-field model, where `field?: T` makes absent and `undefined`
interchangeable.

## Consequence: `Object.entries` and `Object.values` require a filter

`Object.entries` and `Object.values` are not allowed in isolation. They are only
permitted as part of the whitelisted patterns that immediately filter out `undefined`:

```ts
Object.entries(a).filter(([, v]) => v !== undefined)
Object.values(a).filter(v => v !== undefined)
```

Bare `Object.entries(a)` or `Object.values(a)` without the filter is a compile-time error.

The `in` operator is also prohibited, because `'x' in { x: undefined }` returns `true`
in JavaScript despite the property being non-existent under the FS model.

## Motivation

In JavaScript, `{ x: undefined }` and `{}` behave differently under `Object.entries`
and `Object.values`, even though the two objects are logically identical under the FS
object model. This discrepancy is a source of subtle bugs in serializers, equality
checks, and merge functions. Making undefined properties non-existent by rule eliminates
the entire class at the language level.

## Related

- [undefined](./2310-undefined.md) — the `undefined` value in DJS
- [built-in](./2360-built-in.md) — `Object.entries` / `Object.values` side-effect table
- `fs/types/object/module.f.ts` — `definedEntries` and `definedValues` helpers
