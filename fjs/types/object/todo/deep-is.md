# Add `deepIs`

**Priority:** P3
**Status:** open

## Goal

Add a small recursive equality helper to `fjs/types/object/module.f.ts`:

```ts
export const deepIs = (a: unknown, b: unknown): boolean => ...
```

`deepIs` should use `Object.is` for values that do not require structural
comparison, while recursively comparing arrays and non-null objects.

## Semantics

1. Call `Object.is(a, b)` first. If it returns `true`, return `true`.
   This preserves `Object.is` behavior for primitives, `NaN`, signed zero, and
   identical object references.
2. If only one value is a non-null object, return `false`.
3. If only one value is an array, return `false`.
4. If both values are arrays:
   - require the same `length`;
   - recursively compare each value at the same index with `deepIs`.
5. Otherwise, both values are non-null, non-array objects:
   - require the same set of own enumerable string properties, ignoring order;
   - recursively compare the value of every property with `deepIs`.

For example:

```ts
deepIs(NaN, NaN) // true
deepIs(0, -0) // false

deepIs(
    { a: 1, b: { c: 2 } },
    { b: { c: 2 }, a: 1 },
) // true

deepIs({ a: undefined }, {}) // false
deepIs([1, { a: 2 }], [1, { a: 2 }]) // true
deepIs([1, 2], [2, 1]) // false
```

## Initial scope

Keep the first implementation small and suitable for FunctionalScript data:

- compare values, not property descriptors or prototypes;
- do not add special handling for symbols, dates, maps, sets, typed arrays, or
  other host objects;
- do not add cycle detection;
- array comparison is based on length and indexed values, not custom properties.

These cases can be added later when a concrete use requires them.

## Tasks

- [ ] Add `deepIs` to `fjs/types/object/module.f.ts`.
- [ ] Use `Object.is` as the fast path and primitive comparison rule.
- [ ] Compare arrays by length and recursively by index.
- [ ] Compare object property sets without depending on property order.
- [ ] Add proof cases for primitives, `NaN`, signed zero, arrays, nested values,
      reordered object properties, and missing properties whose value would read
      as `undefined`.
- [ ] Run `npx tsc` and `fjs t`.
