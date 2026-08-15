## `splitFirst`/`splitLast` read a nullish element as an empty array

**Priority:** P3
**Status:** open

### Problem

`splitFirst` and `splitLast` test emptiness with `first(a) === null` /
`last(a) === null`, but `first`/`last` go through `fromUndefined`, so a
*stored* `null` or `undefined` element is indistinguishable from a missing
one. A one-element array therefore reports as having no first element:

```js
splitFirst([null])       // null      — should be [null, []]
splitFirst([undefined])  // null      — should be [undefined, []]
splitLast([1, undefined])// null      — should be [[1], undefined]
tail([null])             // []        — correct: length-based guard
head([1, undefined])     // [1]       — correct: length-based guard
```

`tail`/`head` are right and the split pair is wrong, so the module answers
"is this array empty?" two different ways. `at`/`first`/`last` returning
`null` for a nullish element is defensible — they cannot express "present and
null" in a `T | null` return — but `splitFirst`/`splitLast` **can**: their
result already distinguishes the two, since `[null, []]` is not `null`.

This is not hypothetical for `T` unconstrained by nullish: `List<T>` values,
JSON data (`Unknown` includes `null`), and `Nullable<T>` element types all
reach these accessors.

### Proposal

Guard on length, the way `tail`/`head` do (they share `onNonEmpty`), and take
the element by index rather than through `fromUndefined`:

```js
export const splitFirst = onNonEmpty(a => [a[0], uncheckTail(a)])
export const splitLast = onNonEmpty(a => [uncheckHead(a), a[a.length - 1]])
```

Both then have `readonly [T, readonly T[]] | null` where the `null` means
exactly "the array was empty", which is what the type claims.

Typing needs care: indexing a `readonly T[]` gives `T` only without
`noUncheckedIndexedAccess` (the repo has it off), so `a[0]` types as `T` and
no cast is needed — but confirm against the emitted declarations rather than
assuming, and keep the existing public signatures.

### Tasks

- [ ] Rewrite `splitFirst`/`splitLast` on `onNonEmpty` with index access.
- [ ] Add proof cases for `[null]`, `[undefined]`, and a nullish last element
      — the cases that currently answer `null`.
- [ ] Check the callers: a consumer that treats `splitFirst(...) === null` as
      "empty" gets *more* non-null results after the fix, so verify none
      relied on the old conflation to skip nullish heads.
- [ ] `npx tsc`, `fjs test`.

### Related

- [split-last-nullable-map](split-last-nullable-map.md) — proposes routing
  `splitLast` through `nullable.map` to match `splitFirst`. That is a pure
  refactor of the *current* semantics and would preserve this defect in a
  tidier form; land this issue first, or land them together, since the
  `nullable.map` shape is exactly what has to go.
- `fjs/types/array/module.f.mjs` — `onNonEmpty`, the length-based guard
  `tail`/`head` already share and the one these should use.
