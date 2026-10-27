## `SizedIndex::get`: "element `i` if in bounds", once

**Priority:** P4
**Status:** open

### Problem

[`SizedIndex`](../src/common/sized_index.rs) has `length` and a default
`last`, and no `get`. So the bounds rule is written wherever an element may
be absent:

```rust
// vm/lambda/method.rs, `present` — pub(super), so unreachable from other crates
(i < args.length()).then(|| args[i].clone())
// effects-node/src/codec.rs, `optional_argument` — the same, re-derived for that reason
(index < payload.length()).then(|| payload[index].clone())
// vm/array/argument.rs, `Array::argument`
if i < self.length() { self[i].clone() } else { Any::undefined() }
// vm/member_access.rs, `in_bounds`
index.filter(|&i| i < container.length()).map(|i| read(container, i))
```

### Proposal

A default `fn get(&self, i: I) -> Option<&Self::Output>` on `SizedIndex`,
beside `last`. Then `Array::argument` is
`self.get(i).cloned().unwrap_or_else(Any::undefined)`; `present` becomes a
public `Array::present(i)` next to `argument`, and
`codec::optional_argument` is deleted for `payload.present(index)`;
`in_bounds` reads through `get`. The rule is then on the trait that already
carries `length` and `last`.

### Tasks

- [ ] `SizedIndex::get` with a unit test.
- [ ] `argument`, `present`, `in_bounds` and `optional_argument` over it.

### Related

- [sized-index-for-refs](./sized-index-for-refs.md) — the trait's evolution.
- [member-functions](./member-functions.md) — the adapters that call
  `present`.
