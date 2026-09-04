## `rangeEncode` cannot spell the top symbol

**Priority:** P3
**Status:** open

### Problem

`rangeEncode` refuses a range whose exclusive upper boundary is not a safe
integer, which makes `rangeEncode(a, Number.MAX_SAFE_INTEGER)` throw — the top
ordinary symbol has no spelling.

ebnf-range-set gives it one: a range set is
a list of boundaries that may be *open above*, and the top symbol is the open
tail `[a]` — "`[2 ** 53 - 1]` is its singleton, and `[a]` is `a` up to and
including it, the only spelling either has, because the boundary after the top,
`2 ** 53`, is not safe and is rejected."

Refusing is not wrong the way the earlier behaviour was — before the check,
`rangeEncode(a, MAX_SAFE_INTEGER)` returned the boundary `2 ** 53`, which is
`2 ** 53 + 1` rounded and so names a range one symbol short of the one asked
for. The domain is incomplete rather than silent, which is why this is an
issue and the two beside it are not. But incomplete is still not what the
record says.

### Proposal

Return the open tail for the top symbol: `['set', a]` when
`b === Number.MAX_SAFE_INTEGER`, and `['set', a, b + 1]` otherwise. Keep the
refusal for a larger `b`. The `range_set` algebra already carries open tails,
so `union`, `remove` and the rest need nothing.

### Tasks

- [ ] Spell the top symbol as the open tail in `rangeEncode`; keep rejecting a
      `b` above it.
- [ ] Prove the singleton `[MAX_SAFE_INTEGER]`, a range ending at it, and that
      `union` and `remove` carry an open tail through unchanged.

### Related

- ebnf-range-set — the open tail and why it
  is the top symbol's only spelling.
- [`../module.f.mjs`](../module.f.mjs) — `rangeEncode`.
- [`fjs/types/range_set/`](../../types/range_set/module.f.mjs) — the algebra
  that already carries open tails.
