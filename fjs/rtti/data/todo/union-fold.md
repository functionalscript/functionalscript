## union-fold. The TypeScript printer and the JSON Schema printer walk a union the same way

**Priority:** P3
**Status:** open

### Problem

[`fjs/rtti/ts`](../../ts/module.f.mjs) renders a `data` union as a
TypeScript type and [`fjs/media/json/schema`](../../../media/json/schema/module.f.mjs)
renders the same union as a JSON Schema. The two are one traversal
written twice, with only the leaves different. Both open by stripping
the absent bit and answering the top:

```js
// rtti/ts unionToTs
const u = withoutUnits(absentBit)(u0)
if (isTop(u)) { return 'unknown' }
// json/schema unionSchema
const u = withoutUnits(absentBit)(u0)
if (isTop(u)) { return {} }
```

Both then visit the six kinds in the same order with the same
`kindFold` algebra, character for character:

```js
// rtti/ts kindToTs, and json/schema kindSchemas
kindFold({ absent: () => [], whole: () => [whole], members: list => list.map(item) })(k)
```

Both decode the unit bits — `null`, `undefined`, `boolean`, `false`,
`true` — with the same three-arm ternaries (`unitToTs`, `unitSchemas`),
and both compute how many leading array items are required the same
way (`arraySetToTs`, `minLength`):

```js
prefix.findLastIndex(n => !admitsAbsence(rules)(n)) + 1
```

So the knowledge of how a union is laid out — which bits are units,
which kinds exist, where the required prefix ends — lives in two
printers instead of in `fjs/rtti/data`, which owns the bits and
`kindFold`. A third renderer would copy it a third time.

### Proposal

`fjs/rtti/data` exports the fold, and a printer is an algebra:

```ts
type UnionAlgebra<R> = {
    readonly top: () => R
    readonly unit: (name: 'null' | 'undefined' | 'boolean' | 'false' | 'true') => R
    readonly whole: (kind: 'number' | 'string' | 'bigint' | 'array' | 'object') => R
    readonly item: (kind: 'number' | 'string' | 'bigint', value: unknown) => R
    readonly array: (set: ArraySet) => R
    readonly object: (set: ObjectSet) => R
    readonly join: (members: readonly R[]) => R
}
export const unionFold: <R>(algebra: UnionAlgebra<R>) => (u: UnionSet) => R
/** How many leading items of a prefix are required: the index after the last that does not admit absence. */
export const requiredPrefix: (rules: RuleSet) => (prefix: readonly Node[]) => number
```

`unionToTs` is `unionFold` with `join: union`, `top: () => 'unknown'`
and the TS leaves; `unionSchema` is the same fold with `join` building
`anyOf` and `top: () => ({})`. The two printers keep only what is theirs
to say.

### Tasks

- [ ] `unionFold` and `requiredPrefix` in `fjs/rtti/data`, proved at 100%.
- [ ] `fjs/rtti/ts` and `fjs/media/json/schema` as two algebras; their
      proofs pass unchanged.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [container-read-skeleton](../../todo/container-read-skeleton.md) — the
  same two-copies shape between `validate` and `parse`; the read side of
  what this is for the print side.
- [157-json-djs-shared-value-machine](../../../media/json/todo/157-json-djs-shared-value-machine.md)
  — the serializer walkers' analogue.
