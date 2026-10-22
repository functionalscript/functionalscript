## inherited-declared-member. A declared member named like an `Object.prototype` member reads the inherited one

**Priority:** P3
**Status:** open

### Problem

The readers ask a declared member's presence with `in` (HasProperty) and read
it with `getItem`, both through the prototype
([`common`](../common/module.f.mjs), `consPresent` and the container
skeletons). A plain object inherits `Object.prototype`'s members, so a struct
that declares one of their names sees it on every value:

```js
const s = { toString: or(option, number) }
parse(s)({})               // ['error', { path: ['toString'], message: 'no match' }]
validate(s)({})            // ['error', { path: ['toString'], message: 'no match' }]
validate(toData(s))({})    // ['error', { path: ['toString'], message: 'unexpected value' }]
```

`{}` is a DataJS value and `Ts<typeof s>` admits it, so all three readers
refuse a value the schema describes. A required `constructor: number` fails the
same way with 'unexpected value' instead of a missing-member error.

### Direction

Ask a declared struct member's presence as an own property
(`Object.hasOwn`) and read it only when present. Array positions keep `in`
only if a tuple must see inherited indices, which DataJS values never carry.
The three readers must change together; `validate/proof.f.mjs`'s agreement
table is where a case for this belongs.
