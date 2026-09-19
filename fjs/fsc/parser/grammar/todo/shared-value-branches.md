## shared-value-branches. `value`, `unary` and `body` restate four branches each

**Priority:** P4
**Status:** open

### Problem

Three rules in [`module.f.mjs`](../module.f.mjs) open with the same four
branches and differ only in their tail:

```js
// value                              // unary                              // body
neg: [sym('-'), trivia, unary],       neg: [sym('-'), trivia, unary],       neg: [sym('-'), trivia, unary],
primitive: primitiveValue,            primitive: primitiveValue,            primitive: primitiveValue,
ref: reference,                       ref: reference,                       ref: reference,
array: [array, accesses],             array: [array, accesses],             array: [array, accesses],
object: [object, accesses],           object: [object, accesses],           paren,
paren,                                group: parenGroup,                    block,
```

and `Value`, `Unary` and `Body` in [`types.ts`](../types.ts) repeat the
same four members a fourth, fifth and sixth time. The reader side is
already one: `mappings` binds a single `toNode` to all three rules, with
the comment "its branches are the value's, so the same reader serves it".
The three long doc comments spend their words explaining the *differences*
— no `object` in `body`, `paren` against `parenGroup`, `block` only in
`body` — which are the only lines a reader wants to see, and the ones the
repetition buries. The failure mode is a form added to `value` and not to
`unary`, so `-` silently loses it.

### Proposal

Name the shared four once, in both files:

```js
const valueBranches = /** @type {const} */ ({
    neg: [sym('-'), trivia, unary],
    primitive: primitiveValue,
    ref: reference,
    array: [array, accesses],
})
export const value = () => ['const', { ...valueBranches, object: [object, accesses], paren }]
export const unary = () => ['const', { ...valueBranches, object: [object, accesses], group: parenGroup }]
export const body = () => ['const', { ...valueBranches, paren, block }]
```

with a `ValueBranches` type the three types intersect. Each rule then
reads as its difference, and the doc comments shrink to the reason for
it. `proof.f.mjs` pins the branch tags, so the shape is checked.

### Tasks

- [ ] `valueBranches` and `ValueBranches`; the three rules and three types
      over them; proofs unchanged.
- [ ] `tsc`, `fjs test`.

### Related

- [`../../todo/value-token-kind-list.md`](../../todo/value-token-kind-list.md) —
  the token kinds *inside* `primitive`; this is the alternation around it.
- [`../../todo/statement-aware-intrinsics.md`](../../todo/statement-aware-intrinsics.md) —
  will add branches to these rules; cheaper once they are written once.
