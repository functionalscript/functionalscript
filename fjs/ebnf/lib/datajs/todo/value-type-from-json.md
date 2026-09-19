## value-type-from-json. The DataJS `Value` type restates JSON's while the value spreads it

**Priority:** P4
**Status:** open

### Problem

The runtime grammar is already derived:

```js
// fjs/ebnf/lib/datajs/module.f.mjs, value
export const value = () => ['const', {
    ...createValue(property, value),
    number, // replace the JSON number
    nan: 'NaN', undefined: 'undefined', id,
}]
```

Its type in [`types.ts`](../types.ts) writes all ten members out, seven of
them a copy of `fjs/ebnf/lib/json/types.ts`'s `Value<P, V>`, from which it
already imports `Container` and `Entry`. If `createValue` gains a branch,
the DataJS *value* gains it and the annotated type does not, so a mapping's
`switch` keeps type-checking while missing a branch the grammar produces.

### Proposal

Spell the type the way the value is built:

```ts
export type Value<V extends Rule> =
    Omit<JsonValue<typeof property, V>, 'number'>
    & { readonly number: typeof number, readonly nan: 'NaN', readonly undefined: 'undefined', readonly id: typeof id }
```

with JSON's `Value` imported under a distinguishing name.

### Tasks

- [ ] Rewrite the type; `tsc` with no change to any consumer.

### Related

- [`../../../../media/todo/parser-meta-accessors.md`](../../../../media/todo/parser-meta-accessors.md) —
  shares the readers over these grammars; this shares the grammar's type.
