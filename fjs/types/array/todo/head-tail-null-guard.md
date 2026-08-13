## `head`/`tail` re-inline the emptiness guard

**Priority:** P4
**Status:** open

### Problem

```js
export const tail = a => a.length === 0 ? null : uncheckTail(a)   // :59
export const head = a => a.length === 0 ? null : uncheckHead(a)   // :72
```

`tail` is the second projection of `splitFirst` and `head` is the first
projection of `splitLast`; both re-inline the emptiness guard that
`first(a) === null` / `last(a) === null` already expresses, and both write the
same `a.length === 0 ? null : …` line by hand. In a module whose house style
routes absence through `nullable.map` (`splitFirst`, `:64-69`), these are two
holdouts writing the guard themselves.

### Proposal

`export const tail = a => map(([, t]) => t)(splitFirst(a))` and
`export const head = a => map(([h]) => h)(splitLast(a))` — the four accessors
become one family with the null-dispatch stated once. If the intermediate
tuple is unwanted, at minimum factor the shared shape:
`const onNonEmpty = f => a => a.length === 0 ? null : f(a)` with
`tail = onNonEmpty(uncheckTail)`, `head = onNonEmpty(uncheckHead)`.

### Tasks

- [ ] Derive `head`/`tail` from the split functions (or a shared guard)

### Related

- [split-last-nullable-map](split-last-nullable-map.md) — same rule applied
  to `splitLast`'s own body
