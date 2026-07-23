## balanced-fold. Make `fold` a balanced (pairwise) reduction, not a left fold

**Priority:** P4
**Status:** open

### Problem

`fold` in `fjs/common/monoid/module.f.ts` is a strict left fold — it derives
from list `reduce`, so it evaluates `((((a op b) op c) op d) op e)`. For an
associative `operation` that maximally-unbalanced tree is wasteful, in two
distinct ways:

- **Speed**, for size-growing exact operations (`bigint.product`, `bigint.sum`
  of large values, string and bit-vector `concat`). A left fold grows the
  accumulator while each new operand stays small, so step *k* costs work
  proportional to *k*, and the total is O(n²). Balancing the tree keeps both
  sides of every merge comparable in size and brings it down to O(n log n).
- **Accuracy**, for `number.sum`. IEEE-754 addition is not truly associative;
  a left fold accumulates O(n·ε) rounding error, whereas pairwise summation
  bounds it at O(log n · ε). This is not a motivation — the current `sum` is
  fine and we are not chasing accuracy — but since `number.sum` is associative
  it goes through the same balanced `fold` as everything else, and the
  better-on-average accuracy simply comes along for free (a `number` addition
  is O(1), so there is no speed angle here either way).

This is not speculative: `fjs/types/bit_vec/module.f.ts` already implements
exactly this algorithm for its own `concat` reduction. `unpackListToVec`
(the `listToVecOp` accumulator) is a **binary-counter accumulator** — slot `i`
holds an already-combined run of the most recent `2 ** i` elements, each
arriving element carries upward merging only with runs of comparable size,
"giving O(n log n) total `bigint` shifting work instead of the O(n²) of a naive
left fold". The pattern is proven in-repo; it is just trapped inside `bit_vec`
for one concrete operation instead of living in the shared monoid layer.

### Proposal

Reduce a `List<T>` through a **balanced binary-counter accumulator** in `fold`,
generalising the `bit_vec` implementation into `fjs/common/monoid`.

`fold` is the correct — and only correct — home for this. `reduce` takes an
arbitrary `Reduce<T>` with no associativity contract, so it must stay strictly
left-to-right. `fold` takes a `Monoid`, whose contract *promises*
associativity, which is precisely the license to re-parenthesise. So the split
falls out cleanly:

- `reduce` — ordered, no reassociation.
- `fold` — free to balance.

It also makes the monoid module internally consistent: `repeat` already
exploits associativity for log-depth work (exponentiation by squaring); a
balanced `fold` is the list-shaped sibling of that.

The algorithm (mirroring `listToVecOp`), maintaining a stack of accumulators
where `stack[i]` holds a combined run of `2 ** i` elements:

- For each incoming element, `carry = element`, `i = 0`; while `stack[i]` is
  occupied, `carry = operation(stack[i])(carry)` (earlier run stays on the
  **left** — order preserved), clear the slot, `i++`; then store `carry` at
  `stack[i]`.
- At the end, combine the occupied slots from the highest (earliest) down to
  the lowest so left-to-right element order is preserved, seeding an empty list
  at `identity`.

Re-parenthesising only changes grouping, never order, so this stays correct for
**non-commutative** monoids (string `concat`, `bit_vec` `concat`) — the same
ordering discipline `unpackListToVec` already documents.

### Decisions

- **Every associative operation uses this balanced `fold`, uniformly** —
  including `number.sum`. One combinator; no `fold` / `foldBalanced` split. The
  `Monoid` associativity contract is what makes reassociation always valid, so
  there is no reason to expose a second, ordered variant of `fold`.
- **Output changes are acceptable.** Exact monoids (`bigint`, `string`,
  `bit_vec`) stay bit-identical — only cost changes. `number.sum` changes bits
  and its accuracy improves on average; that improvement is an incidental free
  benefit of the uniform treatment, **not** a goal. We are not doing accuracy
  work — no Kahan/Neumaier compensated summation, which is `number`-specific,
  does not generalise to a monoid, and is out of scope. Just update any proof
  that asserts an exact `number.sum` value to the new result.

### bit_vec integration

No fallible or short-circuiting variant of `fold` is needed. Fold the
`maxLength` guard **into the operation** by making `bit_vec`'s concat a monoid
over `Nullable<Unpacked>`:

- `identity` is the empty unpacked (non-null).
- `null` is an **absorbing element**:
  `operation(null)(_) = operation(_)(null) = null`.
- otherwise `operation(a)(b)` concatenates, but returns `null` when the combined
  `length` exceeds `maxLength`.

This is a lawful monoid. `length` is additive and non-negative, so any
intermediate sum is ≤ the total; a partial combine can only exceed `maxLength`
when the total does, and the top-level combine always sees the full total.
Hence the result is `null` **iff** the total length exceeds `maxLength`,
independent of grouping — so the balanced fold's reassociation is safe.
`bit_vec.tryListToVec` then becomes the generic balanced `fold` over this
monoid, with `null` meaning "overflowed"; the `len` bookkeeping and the
`Accumulator` / `ListToVecState` machinery go away.

Accepted trade-off: unlike today's `unpackListToVec`, this does **not** break
out the moment the cap is crossed — the fold runs to completion and `null`
simply propagates as the absorbing element, so overflow is reported at the end
rather than short-circuited. That is fine; reusing one generic `fold` is worth
finishing a walk over an already-doomed list.

### Tasks

- [ ] Extract the binary-counter combine skeleton from
      `bit_vec.unpackListToVec` into `fjs/common/monoid` and re-express `fold`
      on top of it; keep left-to-right order.
- [ ] Route every associative reduction through the balanced `fold`, including
      `number.sum`.
- [ ] Re-express `bit_vec`'s `tryListToVec` as the balanced `fold` over a
      `Nullable<Unpacked>` monoid whose operation is null-absorbing and caps at
      `maxLength`; delete the `Accumulator` / `ListToVecState` bookkeeping.
- [ ] Update any proof asserting an exact `number.sum` value to the new result;
      confirm `bigint` / `string` / `bit_vec` results are unchanged.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- `fjs/common/monoid/module.f.ts` — `fold` (the left fold to replace) and
  `repeat` (already balanced via exponentiation by squaring).
- `fjs/types/bit_vec/module.f.ts` — `unpackListToVec` / `listToVecOp`, the
  in-repo binary-counter accumulator this generalises.
- `fjs/types/number/module.f.ts` — `sum`, the reduction whose accuracy improves
  and whose output changes.
- `fjs/types/bigint/module.f.ts`, `fjs/types/string/module.f.ts` — `product` /
  `sum` / `concat`, the reductions that gain the O(n log n) speedup.
