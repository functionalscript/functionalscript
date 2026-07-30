# Add `structurallySame` and `assertStructurallySame`

**Priority:** P3
**Status:** open

## Problem

`fjs/types/rtti/parse/proof.f.ts` contains a private `assertDeepEqual` helper for
checking parsed FunctionalScript data. It recursively compares arrays and plain
records, but it is ad hoc and cannot be reused by other proofs:

- primitive comparison uses `===`, so it does not preserve `Object.is` behavior
  for `NaN` and signed zero;
- failures are reported through bespoke `if`/`throw` branches instead of the
  shared assertion module;
- the recursive comparison logic is embedded in one proof file even though the
  same operation is useful whenever tests compare independently constructed
  FunctionalScript data.

Proofs also commonly serialize values only to compare their structure. For
example, `fjs/cas/evo/proof.f.ts` compares a computed cache with `emptyCache` by
calling `JSON.stringify` on both values. The BNF proofs contain many similar
candidates where parser or dispatch results are converted to JSON strings and
compared with serialized expected values.

Using serialization as an equality helper has unrelated semantics:

- object property order becomes observable even when order is irrelevant;
- properties containing `undefined` can disappear;
- `NaN`, infinities, and signed zero do not preserve `Object.is` semantics;
- proofs allocate and compare intermediate strings instead of directly stating
  the expected value.

The immediate consumers are the RTTI parse proof and proofs that use a JSON
serializer only as an incidental structural-comparison mechanism. The helper is
intended for FunctionalScript-style data—primitives, arrays, and record-like
objects—not as semantic comparison for dates, maps, sets, typed arrays, or
arbitrary host objects. Accepting `unknown` is useful at assertion and parsing
boundaries, but the result only describes the structural rules below.

## Proposal

Add a small recursive comparison helper to `fjs/types/object/module.f.ts`:

```ts
export const structurallySame = (a: unknown, b: unknown): boolean => ...
```

Add the corresponding assertion helper to `fjs/asserts/module.f.ts`:

```ts
export const assertStructurallySame =
    (...x: readonly [unknown, unknown, unknown?]): void => ...
```

The assertion name uses the comparison name as its suffix, consistently with the
`assert*` naming convention.

`structurallySame` uses `Object.is` for values that do not require structural
comparison, while recursively comparing arrays and non-null objects.
`assertStructurallySame(a, b, msg?)` returns normally when
`structurallySame(a, b)` is `true` and otherwise throws the compared values plus
the optional message, following the existing `assertEq` shape.

Use `assertStructurallySame` in proofs when serialization is only a workaround
for comparing independently constructed values. Keep serialized-string
comparisons when serialization itself is the behavior under test, or when the
API intentionally returns serialized text.

For example:

```ts
assertStructurallySame(cache, emptyCache)
```

is preferable to:

```ts
assertEq(JSON.stringify(cache), JSON.stringify(emptyCache))
```

### Semantics

1. Call `Object.is(a, b)` first. If it returns `true`, return `true`.
   This preserves `Object.is` behavior for primitives, `NaN`, signed zero, and
   identical object references.
2. If only one value is a non-null object, return `false`.
3. If only one value is an array, return `false`.
4. If both values are arrays:
   - require the same `length`;
   - recursively compare each value at the same index with `structurallySame`.
5. Otherwise, both values are non-null, non-array objects:
   - require the same set of own enumerable string properties, ignoring order;
   - recursively compare the value of every property with `structurallySame`.

The generic `unknown` signature does not imply special semantics for every host
object. Under this algorithm, an unsupported host object is compared only by its
own enumerable string properties. Callers that require date, map, set, typed-array,
prototype, or descriptor semantics must use a more specific comparison.

For example:

```ts
structurallySame(NaN, NaN) // true
structurallySame(0, -0) // false

structurallySame(
    { a: 1, b: { c: 2 } },
    { b: { c: 2 }, a: 1 },
) // true

structurallySame({ a: undefined }, {}) // false
structurallySame([1, { a: 2 }], [1, { a: 2 }]) // true
structurallySame([1, 2], [2, 1]) // false

assertStructurallySame(
    { a: 1 },
    { a: 1 },
)
```

### Initial scope

Keep the first implementation small and suitable for FunctionalScript data:

- compare values, not property descriptors or prototypes;
- do not add special handling for symbols, dates, maps, sets, typed arrays, or
  other host objects;
- do not add cycle detection;
- array comparison is based on length and indexed values, not custom properties.

These cases can be added later when a concrete consumer requires them.

## Tasks

- [ ] Add `structurallySame` to `fjs/types/object/module.f.ts`.
- [ ] Add `assertStructurallySame` to `fjs/asserts/module.f.ts`.
- [ ] Replace the private `assertDeepEqual` in
      `fjs/types/rtti/parse/proof.f.ts` with `assertStructurallySame`.
- [ ] Replace proof comparisons that serialize both actual and expected values
      only to compare structure, starting with `fjs/cas/evo/proof.f.ts`.
- [ ] Audit proof files that compare a computed value with a JSON string, including
      the BNF proofs; replace cases where serialized text is not the contract with
      direct expected values and `assertStructurallySame`.
- [ ] Keep serializer proofs and APIs that intentionally return serialized text
      as string comparisons.
- [ ] Use `Object.is` as the fast path and primitive comparison rule.
- [ ] Compare arrays by length and recursively by index.
- [ ] Compare object property sets without depending on property order.
- [ ] Add proof cases for primitives, `NaN`, signed zero, arrays, nested values,
      reordered object properties, and missing properties whose value would read
      as `undefined`.
- [ ] Add assertion proof cases for success, failure, and the optional message.
- [ ] Run `npx tsc` and `fjs t`.

## Related

- [`fjs/types/rtti/parse/proof.f.ts`](../../rtti/parse/proof.f.ts) — contains the
  private `assertDeepEqual` that is the first direct consumer.
- [`fjs/cas/evo/proof.f.ts`](../../cas/evo/proof.f.ts) — compares independently
  constructed cache values through `JSON.stringify`.
- [`fjs/bnf/ll1/proof.f.ts`](../../bnf/ll1/proof.f.ts) and
  [`fjs/bnf/descent/proof.f.ts`](../../bnf/descent/proof.f.ts) — contain serialized
  expected-value comparisons to audit and replace where serialization is incidental.
- [`proof-shared-asserts.md`](../../rtti/todo/proof-shared-asserts.md) — also
  tracks replacing the RTTI proof's local deep-comparison helper with a shared
  assertion.
- [`fjs/asserts/module.f.ts`](../../../asserts/module.f.ts) — existing assertion
  naming and failure-shape conventions.
