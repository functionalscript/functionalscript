# Restructure chain nodes

**Priority:** P2
**Status:** open

## Problem

Four nodes own a chain today — `.`, `?.`, `()`, `?.()`
([`../types.ts`](../types.ts)) — and their operands are wider than their jobs.
`?.()` carries two `lambdas`; `?.` carries an `index` operand that its own
`lambdas` could hold; and a leading `lambdas` admits step shapes that are all
redundant but one. The vocabulary in that position lets a compiler write graphs
that mean nothing new, and the executor walks a step vocabulary where only one
step can ever matter.

## The invariant

The receiver and the short-circuit — the HCF state of
[`../amnesia/module.f.mjs`](../amnesia/module.f.mjs) — are never the result of
an `exp`. Evaluating an `exp` yields an ordinary value and nothing else, which
is what keeps a node context-independent and shareable by identity
(["Chains"](../README.md#chains)). So an HCF must be **born, carried, and
consumed inside one node's `lambdas` walk**; it cannot be handed to a
neighbouring node.

There are exactly two kinds, and that is why there are exactly three nodes.

## Three laws

**Parenthesis law.** Closing an optional region is observable exactly when the
operator that follows is *unguarded*:

```
(X).y        ≢  X.y          (a?.b).c   throws  ·  a?.b.c   is undefined
(X)(...y)    ≢  X(...y)      (a?.b)(c)  throws  ·  a?.b(c)  is undefined
(X)?.y       ≡  X?.y
(X)?.(...y)  ≡  X?.(...y)
```

A guarded operator absorbs the `undefined` a closed region yields; an unguarded
one rejects it. Checked against V8 over 10 chain shapes × 7 input kinds, with no
mismatch. `X` must be built from the chain operators, so that `X op` parses with
all of `X` as the base — the restriction is syntactic, not semantic.

**Minimality.** A `lambdas` should hold exactly one HCF lifetime — the one the
node consumes — and no dead prefix. `['()', a, [['|.', b], ['|.', c]], d]` is
not a legal spelling of `a.b.c(d)`: the first step's receiver is overwritten
before anything consumes it, so it is an ordinary value computation and belongs
in a `.` node. Verified exact, error text included.

**Legitimacy criterion.** A rewrite is available only when the target shape is
not already spoken for, and the survivor is **fully** equivalent — same values,
same throws, same unevaluated operands. "Both throw" is not enough.

## Proposal

```ts
type Property = readonly['.',      Exp, Index]
type This     = readonly['this',   Exp, Lambdas, Exp]
type Option   = readonly['option', Exp, Lambdas]
```

| node | HCF it owns | direction |
| --- | --- | --- |
| `.` | none — a property read | — |
| `this` | the receiver | reaches **back** to the step that made it |
| `option` | the short-circuit | reaches **forward** over what it skips |

`?.()` disappears. An optional call is just a `?.()` step inside a region, and
the receiver it needs comes from a leading `.` step in the *same* `lambdas` — so
the two `lambdas` operands merge, with the call sitting between them instead of
separating them. `?.` loses its `index` operand for the same reason: its own
step becomes the first step of its walk.

Step ids drop the `|` prefix, since a `lambdas` is a distinct operand kind:
`.`, `?.`, `()`, `?.()`.

### Conditions

- Both: at most one `.` before the first optional step.
- `option`: at least one `?.` or `?.()`. Without it,
  `['option', a, [['.', b]]]` would be a second spelling of `a.b`.

`this` needs no cardinality condition, and must not have one: it is the only
node that can call with a receiver, so it has to cover `f(...c)` and
`a.b(...c)` as well as `(a?.b.c)(...d)`. The asymmetry is principled — `option`'s
tag *claims* a short-circuit and the condition enforces the claim; `this` claims
only that a call happens, which is true either way.

### Encodings

| JS | EDAG |
| --- | --- |
| `a.b` | `['.', a, b]` |
| `a?.b` | `['option', a, [['?.', b]]]` |
| `a?.b.c` | `['option', a, [['?.', b], ['.', c]]]` |
| `f(...c)` | `['this', f, [], c]` |
| `a.b(...c)` | `['this', a, [['.', b]], c]` |
| `a.b.c(...d)` | `['this', ['.', a, b], [['.', c]], d]` |
| `(_, a.b)(...c)` | `['this', ['.', a, b], [], c]` |
| `(a?.b)(...c)` | `['this', a, [['?.', b]], c]` |
| `(a?.b.c)(...d)` | `['this', a, [['?.', b], ['.', c]], d]` |
| `a?.b(...c)` | `['option', a, [['?.', b], ['()', c]]]` |
| `f?.(...c)` | `['option', f, [['?.()', c]]]` |
| `a.b?.(...c)` | `['option', a, [['.', b], ['?.()', c]]]` |
| `a.b?.(...c).d` | `['option', a, [['.', b], ['?.()', c], ['.', d]]]` |
| `((a?.b).c)?.(...d)` | `['option', ['option', a, [['?.', b]]], [['.', c], ['?.()', d]]]` |

Every row was checked against V8 through its equivalent in the current node set;
no mismatch. The last row is why the leading `.` is permitted at all: the
receiver for `?.()` comes from `.c` applied to an already-completed region, and
lowering it to a `.` node in the base would lose it.

The collapse of `?.()` relies on the parenthesis law — `(a?.b.c)?.(...d)` has to
lower to the flat `option` form. That is a question of *expressibility*: were the
law wrong, the spelling would become unwritable rather than silently wrong.

## Why `this` keeps a full `lambdas`

It is the only **unguarded** consumer of a receiver, so a leading optional step
is observable there and irreducible: `(a?.b)(...c)` differs from `a?.b(...c)` —
one throws on a nullish `a`, the other is `undefined`. Two narrowings of it fail
the legitimacy criterion:

- **Drop the operand and recover the receiver from the callee `exp`.**
  `(_, a.b)(...c)` and `a.b(...c)` compute the same callee and differ only in
  the receiver, so the operand must exist.
- **Restrict its ids to `.`.** `['()', a, [['|?.', b], ['|.', c]], d]` and
  `['()', ['?.', a, b, []], [['|.', c]], d]` agree on values but are the
  lowerings of `(a?.b.c)(...d)` and `((a?.b).c)(...d)`, which raise different
  `TypeError`s. The target shape is already spoken for.

## Open questions

**The name `this`.** It sits in the lexical slot of `args` and `frame`, which
*read* the context, so `['this', …]` invites the reading "the current receiver"
rather than "a call that supplies one". It is also a misnomer for
`['this', f, [], c]`, which has no receiver at all.

**Dropping the `|` prefix.** Validation tells a `Lambda` from an `Exp` by
position, so nothing is ambiguous to the schema. But `['.', a, b]` and
`['.', b]` then differ only in arity, and tuples accept trailing extras
(["Caveats"](../README.md#caveats)), so a graph read out of context — by a
human or by generic tooling — no longer distinguishes them on sight.

**The conditions are positional, so the schema cannot state them.** rtti offers
`array(T)` and `or` and nothing else — no cardinality, no order. "At least one
optional step" and "at most one leading `.`" become lowering rules plus a
validation pass, where today `?.`'s optionality is structural. That is the real
price of three nodes instead of four, and it is the same gap as
[`../../types/rtti/todo/excluded-string-values.md`](../../types/rtti/todo/excluded-string-values.md).

**Two refinements to the leading-`.` rule**, both following from minimality and
neither yet decided:

- A leading `.` is *needed* only when a call step consumes it. Before a `?.`
  step it is dead prefix — `['option', a, [['.', b], ['?.', c]]]` equals
  `['option', ['.', a, b], [['?.', c]]]`, verified exact.
- `()` before the first optional step should be forbidden too: it completes an
  earlier HCF lifetime, which belongs in its own `this` node.

## Alternatives considered

**A second tag, `.?.()`** — `['.?.()', Exp, Index, Exp, Lambdas]` alongside a
receiver-less `['?.()', Exp, Exp, Lambdas]`. Superseded: it needs two operands
for the call and its continuation, where `option` carries both in one `lambdas`,
and it leaves five chain nodes instead of three.

**Extend `.`** — `['.', Exp, Index, Lambdas]`, so the receiver its own step
creates is consumed inside its own walk. Superseded by putting the same
machinery in `option`, which already carries a `lambdas`. Extending `.` taxes
the most frequent node with a third operand, and turns plain property paths from
a unique spelling into a combinatorial one.

**Peek at the callee's tag** — recover the receiver when the callee is a `.`
node. Rejected: that shape already denotes `(_, a.b)?.(...c)`, so peeking
relabels the simplest encoding and forces the ordinary reading onto a node whose
only job is erasing a reference. It also makes a node's meaning depend on a
child's tag, so `['.', a, b]` and `[',', [['.', a, b]]]` stop being
interchangeable despite having one value.

**A leading path** — `['?.()', Exp[], Exp, Lambdas]` with the array holding
`a.b.c.d`. Rejected: rtti cannot express `[Exp, ...Index[]]`, and `Exp` and
`Index` overlap (a string is both), so the closest expressible type also admits
an array-literal node in a property position.

## Tasks

- [ ] Settle the name of the second node, and whether step ids keep `|`.
- [ ] Decide the two leading-`.` refinements, then state the conditions in one
      sentence each.
- [ ] Weigh against ["no normal form"](../README.md): this buys canonicality the
      model declines, and moves the truncations into the lowering.
- [ ] If adopted: the node schemas in [`../module.f.mjs`](../module.f.mjs), the
      types in [`../types.ts`](../types.ts), the `Map` and handlers in
      [`../amnesia/`](../amnesia/), the tables in [`../README.md`](../README.md),
      and the `chains` / `optionalCall` proofs.
- [ ] Add the distinguishing pairs as proofs whichever way this goes — each is a
      fact that would break silently under a later "simplification":
      `(_, a.b)(...c)` vs `a.b(...c)`; `((a?.b).c)(...d)` vs `(a?.b.c)(...d)`;
      `((a?.b).c)?.(...d)` vs `(a?.b.c)?.(...d)`; and a trailing `lambdas` moved
      outside its node.

## Related

- [`../README.md`](../README.md) — "Chains", the receiver and short-circuit rules
- [`../../djs/todo/compile-modules-to-edag.md`](../../djs/todo/compile-modules-to-edag.md)
  — the lowering that would have to emit the normal form
- [`../../types/rtti/todo/excluded-string-values.md`](../../types/rtti/todo/excluded-string-values.md)
  — the same class of gap in what rtti can express
- [`../../AGENTS.md`](../../AGENTS.md) §1.5 — a throw is a panic, which is why
  "both throw" tempts and why the legitimacy criterion rejects it anyway
