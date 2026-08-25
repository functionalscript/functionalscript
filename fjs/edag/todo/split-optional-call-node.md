# Split `?.()` by receiver

**Priority:** P2
**Status:** open

## Problem

`optionalCall` is `['?.()', exp, lambdas, exp, lambdas]` ([`../types.ts`](../types.ts)).
Its **first** `lambdas` reaches the callee and may leave the receiver to call it
with. That operand admits all four step ids in any order, but only one shape is
irreducible: a single `['|.', index]`. Every other leading shape has an exactly
equivalent spelling elsewhere in the schema, so the operand is wider than its
job, and the executor walks a step vocabulary in a position where only one step
can ever mean anything.

The trailing `lambdas` is not affected — see [Scope](#scope).

## Background: what a `lambdas` is for

The receiver and the short-circuit — the HCF state of
[`../amnesia/module.f.mjs`](../amnesia/module.f.mjs) — are never the result of
an `exp`. Evaluating an `exp` yields an ordinary value and nothing else, which
is what keeps a node context-independent and shareable by identity
(["Chains"](../README.md#chains)). So an HCF must be **born, carried, and
consumed inside one node's `lambdas` walk**; it cannot be handed to a
neighbouring node.

That gives each node's operands a reason:

| node | consumes a receiver | guarded | leading `lambdas` | trailing `lambdas` |
|---|---|---|---|---|
| `.` | no | — | — | — |
| `?.` | no | — | — | yes |
| `()` | yes | **no** | yes | — |
| `?.()` | yes | yes | yes | yes |

A node reaching **back** for a receiver needs a leading `lambdas`; a node that
can short-circuit needs a trailing one to hold what the skip must cover. `?.()`
is the only node in both columns.

## Two laws

Both hold for any `X` built from `.`, `?.`, `()`, and `?.()` — the restriction
is syntactic, so that `X op` parses with all of `X` as the base.

**Parenthesis law.** Closing an optional region is observable exactly when the
operator that follows is *unguarded*:

```
(X).y        ≢  X.y          (a?.b).c   throws  ·  a?.b.c   is undefined
(X)(...y)    ≢  X(...y)      (a?.b)(c)  throws  ·  a?.b(c)  is undefined
(X)?.y       ≡  X?.y
(X)?.(...y)  ≡  X?.(...y)
```

A guarded operator absorbs the `undefined` a closed region yields; an unguarded
one rejects it. Checked against V8 over 10 chain shapes × 7 input kinds — the
success, short-circuit-at-each-link, nullish-but-present, and
non-nullish-non-callable cases — with no mismatch.

**Legitimacy criterion.** A rewrite is available only when the target shape is
not already spoken for, and the survivor is **fully** equivalent — same values,
same throws, same unevaluated operands. "Both throw" is not enough.

## The leading `lambdas` of `?.()` collapses

Three rewrites normalize any leading `lambdas` to at most one `|.`:

| leading shape | rewrite | why it is exact |
|---|---|---|
| any `\|?.` / `\|?.()`, at any position | the `?.()` dissolves into a `?.` / `?.()` node owning the region, the call becoming a `\|?.()` step in its continuation | the parenthesis law: the guarded call absorbs the step |
| any `\|()` | the prefix through the call becomes an `()` node in the base slot | a call's result is an ordinary value |
| several `\|.` | all but the last fold into `.` nodes | the earlier step's receiver is overwritten by the later one |

What survives is the one `|.` that supplies the receiver — the only thing no
`exp` can carry.

## Proposal

Replace the single node with two, distinguished by whether a receiver exists:

```ts
type OptionalCall         = readonly['?.()',  Exp,        Exp, Lambdas]
type OptionalPropertyCall = readonly['.?.()', Exp, Index, Exp, Lambdas]
```

| JS | EDAG |
|---|---|
| `f?.(...d)` | `['?.()', f, d, []]` |
| `a.b?.(...d)` | `['.?.()', a, 'b', d, []]` |
| `a.b.c?.(...d)` | `['.?.()', ['.', a, 'b'], 'c', d, []]` |
| `((a?.b).c)?.(...d)` | `['.?.()', ['?.', a, 'b', []], 'c', d, []]` |
| `(a(...x).b)?.(...d)` | `['.?.()', ['()', a, [], x], 'b', d, []]` |
| `(_, a.b)?.(...d)` | `['?.()', [',', [_, ['.', a, 'b']]], d, []]` |
| `(a?.b)?.(...d)` | `['?.', a, 'b', [['\|?.()', d]]]` |

The leading step vocabulary disappears from this position. Neither node infers
anything from a child, both are readable locally, and `['?.()', exp, …]` keeps
exactly the meaning it has today with an empty leading `lambdas` — a call on an
ordinary value.

The last row still depends on `(a?.b)?.(...c)` ≡ `a?.b?.(...c)`, but only for
*expressibility*: if that equivalence were wrong the spelling would become
unwritable, not silently wrong.

## Why `()` keeps its `lambdas`

`()` is the only **unguarded** consumer of a receiver, so a leading optional
step is observable there and irreducible. `(a?.b)(...c)` differs from
`a?.b(...c)` — one throws on a nullish `a`, the other is `undefined`. The
asymmetry between the two call nodes is the point, not an inconsistency: `?.()`
*cannot* observe a leading optional step and so should not be able to carry one.

Two rejected narrowings of `()`, both failing the legitimacy criterion:

- **Drop the operand, recover the receiver from the callee `exp`.**
  `(_, a.b)(...c)` and `a.b(...c)` compute the same callee and differ only in
  the receiver, so the operand must exist.
- **Restrict its ids to `|.`.** `['()', a, [['|?.', b], ['|.', c]], d]` and
  `['()', ['?.', a, b, []], [['|.', c]], d]` agree on values but are the
  lowerings of `(a?.b.c)(...d)` and `((a?.b).c)(...d)`, which raise different
  `TypeError`s. The target shape is already spoken for.

## Alternatives considered

**Peek at the callee's tag** — `['?.()', Exp, Exp, Lambdas]`, destructuring the
callee when it is a `.` node. Rejected: that shape already denotes
`(_, a.b)?.(...c)`, so peeking relabels the simplest encoding and forces the
ordinary value-callee reading onto a node whose only job is erasing a reference.
It also makes a node's meaning depend on a child's tag, so `['.', a, 'b']` and
`[',', [['.', a, 'b']]]` stop being interchangeable despite having one value.

**A leading path** — `['?.()', Exp[], Exp, Lambdas]` with the path holding
`a.b.c.d`. Rejected: rtti offers `array(T)` and `or` only — no non-empty array,
no heterogeneous variadic tuple — and `Exp` and `Index` overlap (a string is
both), so the closest expressible type also admits an array-literal node in a
property position. Splitting the base out, `['?.()', Exp, Index[], Exp,
Lambdas]`, is expressible and was the runner-up; the two-tag form was preferred
because it states the receiver in the tag rather than in an operand's length.

## Scope

The trailing `lambdas` of `?.`, `?.()`, and `.?.()` is **not** part of this
proposal. It exists so that a continuation is skippable when the region
short-circuits, which only unguarded steps need — but of the two guarded ids
only `|?.` lifts out. `|?.()` consumes a receiver, so it cannot: `a?.b.c?.(...d)`
is not `(a?.b.c)?.(...d)`. Removing one id from one position is not worth a
schema change.

## Tasks

- [ ] Decide the second tag's name. `.?.()` concatenates two operators, where
      every existing tag is one; `?.` already carries an own property step
      without announcing it.
- [ ] Weigh against ["no normal form"](../README.md): this buys canonicality the
      model declines, and moves the truncations into the lowering.
- [ ] If adopted: `optionalCall` in [`../module.f.mjs`](../module.f.mjs), the
      types in [`../types.ts`](../types.ts), the `Map` and handler in
      [`../amnesia/`](../amnesia/), the tables in [`../README.md`](../README.md),
      and the `chains` / `optionalCall` proofs.
- [ ] Add the distinguishing pairs as proofs regardless of the outcome — each is
      a fact that would break silently under a later "simplification":
      `(_, a.b)(...c)` vs `a.b(...c)`; `((a?.b).c)(...d)` vs `(a?.b.c)(...d)`;
      `((a?.b).c)?.(...d)` vs `(a?.b.c)?.(...d)`; and a trailing `lambdas`
      moved outside its node.

## Related

- [`../README.md`](../README.md) — "Chains", the receiver and short-circuit rules
- [`../../djs/todo/compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md)
  — the lowering that would have to emit the normal form
- [`../../types/rtti/todo/excluded-string-values.md`](../../types/rtti/todo/excluded-string-values.md)
  — the same class of gap in what rtti can express
- [`../../AGENTS.md`](../../AGENTS.md) §1.5 — a throw is a panic, which is why
  "both throw" tempts and why the legitimacy criterion rejects it anyway
